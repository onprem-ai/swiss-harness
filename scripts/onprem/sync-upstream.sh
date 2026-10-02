#!/usr/bin/env bash
# Steps 1-3 of MERGING.md: fetch an upstream tag, advance the pristine
# `upstream` mirror, and open a sync branch off `main`. Stops before the
# merge so conflicts are resolved by a human.
#
# Usage: scripts/onprem/sync-upstream.sh dsh-vX.Y.Z-rc.N
set -euo pipefail

tag="${1:-}"
if [[ -z "$tag" ]]; then
  echo "usage: $0 <upstream-tag>   e.g. $0 dsh-v0.2.0-rc.2" >&2
  exit 2
fi
if [[ "$tag" == *alpha* ]]; then
  echo "refusing: alpha tags are not adopted (MERGING.md, principle 1)" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "refusing: working tree is not clean" >&2
  exit 1
fi

echo "==> fetching $tag"
git fetch upstream tag "$tag" --no-tags

echo "==> advancing pristine mirror branch 'upstream'"
git checkout -q upstream
if ! git merge --ff-only "$tag"; then
  echo "upstream branch cannot fast-forward to $tag; upstream rewrote history. Stop and investigate." >&2
  exit 1
fi
git tag -f "upstream/$tag" "$tag"

echo "==> opening sync branch"
git checkout -q -b "sync/$tag" main

cat <<EOF

Ready. Next steps (MERGING.md step 4 onward):

  git merge upstream
  # resolve conflicts: theirs for pure-rename and pnpm-lock.yaml
  scripts/onprem/rebrand.sh
  pnpm install
  scripts/onprem/rebrand.sh --check
  pnpm run build && pnpm test
  git push origin upstream upstream/$tag sync/$tag
EOF
