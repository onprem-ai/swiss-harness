# Security checks

The same kit as onprem-ai/account-server, copied 2026-10-18.

## Dependencies

`scripts/scan-vulnerabilities.sh [npm|python|image]` reports known vulnerabilities and changes nothing in the repository: pnpm audit (HIGH/CRITICAL, runtime deps) of the workspace lockfile and npm audit of every `package-lock.json`, pip-audit (every finding, runtime deps) of every Python project (`uv.lock`, else `requirements*.txt`, else `pyproject.toml`), Trivy (HIGH/CRITICAL with a fix) on the image of every `Dockerfile` outside test fixtures. `vendor/`, `.agents/` and `.claude/` are left out. New projects are found automatically. After a dependency or base-image change, run it and fix findings by taking the fixed version. Do not suppress a finding without human approval. The workflow `vulnerability-scans.yml` runs the same script by hand from the Actions tab.

## Security skills (Trail of Bits, vendored)

Pinned copies in `.agents/skills/`; source, commit and licence in `.agents/skills/THIRD-PARTY.md`. An agent without skill support reads the `SKILL.md`. They advise, they do not block; reports go to `/tmp/`, not the working tree.

- `supply-chain-risk-auditor`: before adding a dependency or in a dependency review; finds what the CVE scans cannot (abandoned upstreams, single publishers, install scripts).
- `insecure-defaults`: after touching secrets, auth, trust fences, the sandbox or configuration defaults (`packages/host/webserver`, `packages/sandbox`, `packages/credentials`, the `onprem` bundle, `.env.example` files, compose files, the Dockerfile).
- `differential-review`: security review of a branch or PR that touches auth, sessions, cookies, the trust fence, subprocess or sandbox code, or the Dockerfile.

## Before a release

Before a tag that publishes (a Docker image, an npm release), check what is about to go out, from the last released tag to `HEAD`:

1. `scripts/scan-vulnerabilities.sh` (all three scans).
2. `differential-review` on that range, when it touches auth, sessions, cookies, the trust fence, subprocess or sandbox code, or the Dockerfile.
3. `insecure-defaults` on what changed in that range (whole repo when unsure).
4. `supply-chain-risk-auditor` when a manifest or lockfile changed in that range.

Report the findings to the person releasing, with file and line, and let them decide; do not release past a HIGH or CRITICAL finding without their explicit go.
