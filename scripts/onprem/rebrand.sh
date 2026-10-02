#!/usr/bin/env bash
# Deterministic, idempotent rename of the workspace npm scope.
#
#   scripts/onprem/rebrand.sh          apply the rename in place
#   scripts/onprem/rebrand.sh --check  exit 1 if any upstream scope string survives
#
# Scope of this script (see MERGING.md, "What the rebrand script may and may
# not touch"): it renames the *workspace* package scope `@deepseek-ai` to
# `@onprem-ai` in every tracked text file, plus the heading slugs that
# upstream derives from those package names. It does not touch the product
# name, provider defaults, repository URLs, or anything under the exclusion
# list below. Registry-published packages that upstream consumes from the
# public npm scope (the LibreOffice kit) keep their real names, otherwise
# `pnpm install` cannot resolve them.
set -euo pipefail

FROM='deepseek-ai'
TO='onprem-ai'

# Paths never rewritten and never flagged by --check.
#   .agents/notes/archived  upstream's sealed history; every file is content
#                           hashed in manifest.json and the verifier rejects
#                           edits. Treated like git history, not like source.
#   LICENSE                 MIT requires the original notice to stay verbatim.
#   our own files           they mention the upstream scope on purpose.
EXCLUDE_RE='^(\.agents/notes/archived/|LICENSE$|NOTICE\.md$|MERGING\.md$|docs/onprem/|scripts/onprem/)'

# Registry packages that legitimately stay under the upstream scope. The
# lookahead covers the forms that occur in the tree:
#   @deepseek-ai/libreoffice-kit            manifests, lockfile, yaml, prose
#   @deepseek-ai\/libreoffice-kit           escaped inside regex literals
#   '@deepseek-ai', 'libreoffice-kit        path.join('node_modules', '@deepseek-ai', 'libreoffice-kit-...')
#   '@deepseek-ai', `libreoffice-kit        same, template literal
KEEP_LOOKAHEAD='(?!\\?/libreoffice-kit)(?![\x27"], ?[\x27"`]libreoffice-kit)'

mode="${1:-apply}"
cd "$(git rev-parse --show-toplevel)"

# Every tracked or untracked-unignored regular file (not a symlink: perl -i
# would replace the link with a copy) that mentions the upstream scope.
candidates() {
  git ls-files -z --cached --others --exclude-standard \
    | while IFS= read -r -d '' f; do
        [[ -f "$f" && ! -L "$f" ]] || continue
        [[ "$f" =~ $EXCLUDE_RE ]] && continue
        printf '%s\0' "$f"
      done \
    | xargs -0 grep -la -- "$FROM" 2>/dev/null || true
}
# `-a` (not `-I`): one upstream spec file embeds a NUL byte on purpose and
# grep would otherwise classify it as binary and skip it; perl handles it.

# Residual upstream-scope strings after the rename. Allowed survivors:
#   github.com/deepseek-ai/…  the upstream repository URL (separate decision)
#   the LibreOffice kit forms listed above
residuals() {
  local list
  list="$(candidates)"
  [[ -n "$list" ]] || return 0
  printf '%s\n' "$list" | tr '\n' '\0' | xargs -0 perl -ne '
    my $from = q{'"$FROM"'};
    my $line = $_;
    # Remove the registry packages that keep the scope, then report any
    # remaining npm-scope form or package-derived heading slug. A bare
    # "deepseek-ai" (GitHub org URL, HuggingFace model id) is not the scope.
    $line =~ s{\@\Q$from\E(?=\\?/libreoffice-kit)}{}g;
    $line =~ s{\@\Q$from\E(?=[\x27"], ?[\x27"`]libreoffice-kit)}{}g;
    print "$ARGV:$.: $_" if $line =~ /\@\Q$from\E\b/
      || $line =~ /\b\Q$from\E-?(?:dsh|cordis|cosmokit|schemastery|node-addon|website)\b/;
    close ARGV if eof;
  '
}

case "$mode" in
  apply)
    list="$(candidates)"
    count=0
    [[ -z "$list" ]] || count="$(printf '%s\n' "$list" | wc -l | tr -d ' ')"
    echo "==> rewriting $count files: @$FROM -> @$TO"
    if [[ -n "$list" ]]; then
      printf '%s\n' "$list" | tr '\n' '\0' | xargs -0 perl -pi -e '
        # 1. the npm scope itself, except registry packages that keep it
        s{\@'"$FROM"''"$KEEP_LOOKAHEAD"'}{\@'"$TO"'}g;
        # 2. heading slugs upstream derives from package names
        #    "## @deepseek-ai/dsh-foo" -> markdown anchor #deepseek-aidsh-foo
        #                              -> i18n pairing key /deepseek-ai-dsh-foo
        s{\b'"$FROM"'(-?)(dsh|cordis|cosmokit|schemastery|node-addon|website)\b}{'"$TO"'$1$2}g;
      '
    fi
    echo "==> verifying"
    if out="$(residuals)" && [[ -n "$out" ]]; then
      echo "$out" | head -40
      echo "rebrand: $(echo "$out" | wc -l | tr -d ' ') residual upstream-scope lines (see above)" >&2
      exit 1
    fi
    echo "ok: no residual @$FROM workspace references"
    ;;
  --check)
    if out="$(residuals)" && [[ -n "$out" ]]; then
      echo "$out" | head -40
      echo "rebrand --check: $(echo "$out" | wc -l | tr -d ' ') residual upstream-scope lines; run scripts/onprem/rebrand.sh" >&2
      exit 1
    fi
    echo "ok: no residual @$FROM workspace references"
    ;;
  *)
    echo "usage: $0 [--check]" >&2
    exit 2
    ;;
esac
