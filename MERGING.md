# Upstream sync procedure

Swiss Harness is a downstream fork of
[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
(MIT). This document is the single procedure for taking a new upstream
release into this repository. Nothing in it is optional.

## Principles

1. **Pin to upstream tags, never to `master`.** A security review is only
   meaningful against a fixed commit, and upstream `master` churns daily
   while the project is in developer preview. Only `rc` tags are adopted;
   `alpha` tags are skipped.
2. **Keep `upstream` pristine.** The `upstream` branch is a byte-identical
   mirror of the adopted upstream tag. No local commit ever lands on it.
   `git diff upstream main` is therefore the complete, auditable list of
   everything onprem.ai changed.
3. **Keep the diff small and mechanical.** Rebranding is produced by
   `scripts/onprem/rebrand.sh`, not by hand. Behavioural changes live in
   overlay packages that upstream never touches. Direct edits to upstream
   source are a last resort and must be listed in the
   [Hand-maintained edits](#hand-maintained-edits) table below.
4. **One merge commit per sync.** `git log --merges main` reads as the
   history of upstream versions in the product.

## Branches and tags

| Ref | Meaning |
| --- | --- |
| `upstream` branch | Pristine mirror of the currently adopted upstream tag. |
| `upstream/dsh-vX.Y.Z-rc.N` tags | Every upstream tag ever adopted, kept forever for diffing. |
| `main` | `upstream` plus the onprem.ai overlay. Release branch. |
| `swiss-harness-vX.Y.Z` tags | Our releases. Release notes name the upstream tag and the security review date. |

Remotes:

```sh
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
```

Currently adopted upstream tag: **`dsh-v0.2.1-rc.2`** (2026-10-17), mirrored as the `upstream/dsh-v0.2.1-rc.2` tag here. Previous: `dsh-v0.2.0-rc.2`.

## Sync procedure

Run `scripts/onprem/sync-upstream.sh <upstream-tag>`; it performs steps 1
through 3 and stops before the merge so a human resolves conflicts. The
steps are documented here so the script is verifiable.

### 1. Fetch the tag only

```sh
git fetch upstream tag dsh-vX.Y.Z-rc.N --no-tags
```

`--no-tags` keeps upstream's alpha and rc tags out of our tag namespace.

### 2. Advance the pristine mirror

```sh
git checkout upstream
git merge --ff-only dsh-vX.Y.Z-rc.N
git tag upstream/dsh-vX.Y.Z-rc.N dsh-vX.Y.Z-rc.N
git push origin upstream upstream/dsh-vX.Y.Z-rc.N
```

The merge must fast-forward. If it does not, upstream rewrote history;
stop and investigate before continuing.

### 3. Open a sync branch

```sh
git checkout -b sync/dsh-vX.Y.Z-rc.N main
```

### 4. Merge

```sh
git merge upstream
```

Conflicts fall into three classes. Resolve them in this order:

**a. Pure rename conflicts.** The conflict exists only because a line
contains `@deepseek-ai/` on their side and `@onprem-ai/` on ours.
Take **their** version. The rebrand script in step 5 reapplies the rename.

```sh
# Accept upstream for every file where the only difference is the scope.
git checkout --theirs -- <paths>
```

**b. Lockfile.** Always take theirs, then regenerate in step 5.

```sh
git checkout --theirs -- pnpm-lock.yaml
```

**c. Real conflicts** in hand-maintained edits or overlay packages.
Resolve by hand. If upstream has absorbed the change we carried, delete
our copy and remove the row from the table below.

**d. Rename-induced ghosts.** Because every file on our side differs from
upstream by the scope string, git cannot tell "upstream deleted this file"
from "both sides changed it", and a file upstream removed survives the
merge. Likewise a rename-style conflict leaves markers of the form
`<<<<<<< HEAD:<path>`. After step 4, run both checks and resolve them by
taking upstream:

```sh
# files upstream deleted that the merge kept (exclude our overlay paths)
git ls-files | while read -r f; do git cat-file -e "dsh-vX.Y.Z-rc.N:$f" 2>/dev/null || echo "$f"; done \
  | grep -vE '^(MERGING\.md|NOTICE\.md|scripts/onprem/|docs/onprem/|packages/bundle/onprem-app/|packages/client/ui-brand-onprem/)'
# every conflict-marker form, including rename suffixes
git grep -lE '^(<<<<<<< |>>>>>>> )' -- .
```

Delete the first list; restore the second from the upstream tag and
re-apply the hand edits listed in the table below.

**e. Overlay packages follow upstream's package conventions.** When a sync
changes how upstream's sibling packages are declared (the first sync added
locale metadata to every client plugin and switched `tsdown.config.ts` to
`clientBundle(import.meta.dirname, …)`), mirror that in
`packages/client/ui-brand-onprem` and `packages/bundle/onprem-app`, and
bump their `version` to the upstream family version.

**f. New upstream rows that reach the network** get a `disabled: true` row
in `packages/bundle/onprem-app/cordis.patch.yml` and an entry in the
bundle test's egress list, in the same sync.

**g. The unknown-cast baseline is scope-sensitive.** `scripts/no-unknown-casts.baseline.json`
fingerprints each `as unknown` by its syntax tokens, which include package
names, so every upstream baseline entry whose expression names the scope
changes hash after the rename. Re-fingerprint entries file by file where the
cast count is unchanged (never add entries); `scripts/onprem/refingerprint-casts.py`
does exactly that.

**h. Known upstream-side gate failures** that are not ours: `verify-repository-references`
flags `python/sdk/uv.lock` on the pristine upstream tree too (a PyPI URL hash
matches its commit-hash pattern). Record such cases here per sync rather
than editing upstream files.

### 5. Reapply the rebrand

```sh
scripts/onprem/rebrand.sh                   # rewrites the scope and derived slugs
pnpm install --frozen-lockfile              # the renamed lockfile is complete as is
scripts/onprem/rebrand.sh --check           # fails if any upstream scope string survives
pnpm exec tsx scripts/gen-third-party-notices.ts
pnpm exec tsx scripts/verify-translation-pairing.ts --write --all
scripts/onprem/refingerprint-casts.py
pnpm run gen-cli-help && pnpm run gen-client-catalog && pnpm run gen-dependency-catalog && pnpm run gen-module-graph
```

The rebrand script is idempotent and deterministic. Running it twice
produces no further changes. The two generators afterwards exist because
upstream derives content from package names: the notices file quotes the
scope, and every bilingual document carries per-section hashes that the
heading slug rename invalidates. Re-recording them is mechanical and
reviewed through the diff, not by hand.

### 6. Verify

```sh
pnpm run build
pnpm exec tsx scripts/check-workspace-constraints.ts
pnpm exec tsx scripts/verify-translation-pairing.ts
pnpm exec tsx scripts/verify-md-links.ts
pnpm exec tsx scripts/run-oxlint.ts
pnpm exec tsx scripts/run-gates.ts ci-static   # upstream's static aggregate; see conflict class h for known upstream-side failures
pnpm test
```

All must pass before the sync is merged to `main`.

### 7. Record

- Update the "Currently adopted upstream tag" line in this file.
- Review the [Hand-maintained edits](#hand-maintained-edits) table.
- Update `docs/onprem/security/` for anything new that reaches the
  network, bundles a binary, or downloads at runtime. See
  `docs/onprem/security/README.md` for the checklist.
- Open a pull request `sync/... -> main`. The PR description lists
  upstream's release notes link and every row that changed in the table.

### 8. Merge and tag

Merge with a merge commit (not squash, not rebase) so the upstream
history stays reachable. Tag a release only after the security review
for that upstream tag is signed off.

## What the rebrand script may and may not touch

The script renames the **workspace** package scope `@deepseek-ai/*` to
`@onprem-ai/*` in every tracked text file, and the heading slugs upstream
derives from those names (`#deepseek-aidsh-foo` anchors in Markdown,
`/deepseek-ai-dsh-foo` section keys in `.i18n.yaml` pairing records). It
renames nothing else: product name, provider defaults, repository URLs,
environment variables and the `dsh` command are separate decisions.

Excluded from the rename because they are real external dependencies
pulled from the public npm registry, not workspace packages:

| Package | Why excluded |
| --- | --- |
| `@deepseek-ai/libreoffice-kit` and its `-darwin-*`, `-win32-*`, `-wasm` platform packages | Registry dependency, not in this workspace. Renaming it breaks install. |

Any new `@deepseek-ai/*` dependency that is **not** declared via
`workspace:*` or a `link:` override must be added to this table and to
the script's exclusion list.

Never rewritten:

- `LICENSE`: MIT requires the original copyright notice to remain. Our
  attribution lives in `NOTICE.md` at the repository root.
- `.agents/notes/archived/`: upstream's sealed design history. Every file
  is content-hashed in its manifest and upstream's verifier rejects edits.
  It is treated like git history, not like source, and still names the
  upstream scope.
- Bare `deepseek-ai` outside the npm scope, such as the GitHub
  organisation in repository URLs and a HuggingFace model id in a test
  fixture. The check mode ignores these too.

Known consequence: the 332 package manifests still declare upstream's
repository URL, and upstream's constraint checker requires that exact
URL for release members. Changing it is a product decision tracked
separately from the scope rename.

## Hand-maintained edits

Every direct modification of an upstream file that is not produced by
`rebrand.sh`. Keep this table short; each row is a recurring merge cost.

| File | Change | Reason | Upstream issue/PR |
| --- | --- | --- | --- |
| `MERGING.md` | added | this document | n/a |
| `NOTICE.md` | added | MIT attribution for the fork | n/a |
| `scripts/onprem/` | added | sync and rebrand tooling | n/a |
| `docs/onprem/` | added | security review records | n/a |
| `scripts/translation-pairing.manifest.json` | three entries appended | our English-only documents are excluded from upstream's bilingual gate | n/a |
| `packages/bundle/onprem-app/` | added | the deployment patch layer; see its README | n/a |
| `packages/client/ui-brand-onprem/` | added | Swiss Harness sidebar and hero occupants | n/a |
| `packages/boot/app-boot/src/profile.ts` | one `onprem` entry in `PROFILE_TEMPLATES` | `dsh onprem` boots base + web-app + onprem-app | n/a |
| `apps/cli/package.json` | one dependency line | the launcher resolves the onprem bundle | n/a |
| `tsconfig.host.json`, `tsconfig.client.json` | one project reference each | upstream lists these by hand | n/a |
| `tsconfig.base.json` | one hand-written alias | the brand package name does not match its directory, so the generator cannot derive it | n/a |
| `scripts/verify-package-readme-model-experience.ts` | two allowlist rows | the new packages' README shape | n/a |
| `packages/bundle/README*.md`, `packages/client/README*.md` | one table row each, both languages | group READMEs list every package | n/a |
| generated: `docs/config-catalog*.md`, `references/packages.md`, `THIRD_PARTY_NOTICES.md`, `*.i18n.yaml` | regenerated | upstream generators enumerate packages; rerun, never edit | n/a |
| `scripts/no-unknown-casts.baseline.json` | fingerprints re-recorded by `scripts/onprem/refingerprint-casts.py` | the baseline hashes syntax tokens that include the scope | n/a |

## Cadence

Upstream currently ships roughly two rc tags per week. We do not adopt
every one. A sync is triggered by one of:

- a security fix upstream,
- a feature a customer needs,
- more than four weeks since the last sync.
