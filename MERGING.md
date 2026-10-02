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

Currently adopted upstream tag: **`dsh-v0.2.0-rc.2`** (2026-09-29, commit `639ed015`).

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

### 5. Reapply the rebrand

```sh
scripts/onprem/rebrand.sh          # rewrites scope and branding strings
pnpm install                       # regenerates pnpm-lock.yaml
scripts/onprem/rebrand.sh --check  # fails if any upstream string survives
```

The rebrand script is idempotent and deterministic. Running it twice
produces no further changes.

### 6. Verify

```sh
pnpm run build
pnpm test
```

Both must pass before the sync is merged to `main`.

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
`@onprem-ai/*`. The following are explicitly excluded because they are
real external dependencies pulled from the public npm registry, not
workspace packages:

| Package | Why excluded |
| --- | --- |
| `@deepseek-ai/libreoffice-kit` | Registry dependency, not in this workspace. Renaming it breaks install. |

Any new `@deepseek-ai/*` dependency that is **not** declared via
`workspace:*` or a `link:` override must be added to this table and to
the script's exclusion list.

Upstream's `LICENSE` and `THIRD_PARTY_NOTICES.md` are never modified by
the script. MIT requires the original copyright notice to remain. Our
attribution lives in `NOTICE.md` at the repository root.

## Hand-maintained edits

Every direct modification of an upstream file that is not produced by
`rebrand.sh`. Keep this table short; each row is a recurring merge cost.

| File | Change | Reason | Upstream issue/PR |
| --- | --- | --- | --- |
| `MERGING.md` | added | this document | n/a |
| `NOTICE.md` | added | MIT attribution for the fork | n/a |
| `scripts/onprem/` | added | sync and rebrand tooling | n/a |

## Cadence

Upstream currently ships roughly two rc tags per week. We do not adopt
every one. A sync is triggered by one of:

- a security fix upstream,
- a feature a customer needs,
- more than four weeks since the last sync.
