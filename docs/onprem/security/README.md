# Security review

This directory holds the security review of Swiss Harness against a specific upstream tag. Each review is a dated file `review-<upstream-tag>.md`. A Swiss Harness release may only be tagged once a review for its upstream tag is signed off.

## Why

onprem.ai customers deploy Swiss Harness on their own infrastructure and need evidence that the software neither contacts unexpected endpoints nor ships code they cannot inspect. The review produces that evidence.

## Checklist per upstream tag

Every item is answered with a finding, a file reference, and a verdict (`ok`, `mitigated in overlay`, `open`).

### Network egress

- [ ] Every hardcoded hostname or URL in `packages/`, `apps/`, `vendor/`, `python/` and `native/` is listed, with the code path that reaches it.
- [ ] Default model provider and its endpoint. Must point at a customer configurable endpoint in the onprem composition.
- [ ] Telemetry, feedback, webhook and update-check behaviour: what is sent, where, and whether it is off by default in the onprem composition.
- [ ] Runtime package installation: can the harness fetch plugins or packages from the public npm registry during operation? Air-gap behaviour documented.

### Supply chain

- [ ] Lockfile is complete and `pnpm install --frozen-lockfile` succeeds.
- [ ] Every dependency with an install or build script is listed in `pnpm-workspace.yaml` `allowBuilds` and reviewed.
- [ ] Prebuilt binaries: `native/` outputs, the Python runtime wheel, the single-exe build, desktop packaging. Each is either built from source in our CI or justified.
- [ ] Registry-sourced `@deepseek-ai/*` dependencies (see the exclusion table in MERGING.md) are reviewed individually.
- [ ] `patches/` directory: each patch read and understood.
- [ ] `vendor/` tree compared against its declared upstream version (`scripts/check-vendor-manifest.sh`).

### Code execution surface

- [ ] Shell, subprocess, SSH, sandbox and PTC runtime packages: what confinement is on by default on Linux, macOS, Windows.
- [ ] Browser-use and computer-use: disabled or gated in the onprem composition unless the customer opts in.
- [ ] Credential storage: where secrets land on disk and with what permissions.

### Artefacts

- [ ] SBOM generated (CycloneDX) and committed under `sbom/`.
- [ ] License inventory regenerated (`THIRD_PARTY_NOTICES.md`) and diffed against the previous review.
- [ ] Dependency vulnerability scan output attached.

## Sign-off

Each review file ends with reviewer name, date, upstream tag, upstream commit hash, and the list of `open` items accepted for release.
