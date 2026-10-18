---
name: insecure-defaults
description: "Audit a file, directory or the whole repository for insecure default configuration: fallback secrets, default credentials, fail-open security switches, weak crypto, permissive access, debug leakage. Each candidate is traced to the security decision it reaches before it is reported. Use when asked for an insecure-defaults or configuration security audit, before a release, or after changing secrets, auth or config handling."
---

# Insecure defaults audit

<!-- Written for account-server, not part of upstream: Trail of Bits ships this as a
plugin command (commands/audit.md) and a workflow (workflows/audit.js), with no
SKILL.md. Everything else in this directory is upstream, unmodified; see
../THIRD-PARTY.md. -->

The method and the corpus are upstream's: read `README.md` here first (what it finds,
the two candidate shapes, the five refuting steps). `references/<id>.md` holds, per
category, **Report when** / **Skip when** with worked vulnerable/secure pairs;
`references/<id>.json` holds the seed grep patterns (POSIX ERE).

Categories: `fallback-secrets`, `default-credentials`, `fail-open-security`,
`weak-crypto`, `permissive-access`, `debug-features`.

## Run it

**With a workflow tool** (Claude Code's `Workflow`, or any harness that runs the
`export const meta` + script format): run `workflows/audit.js` with
`args: { scope: "<path, default .>", pluginRoot: "<absolute path of this directory>" }`
and print the result by `status` as `commands/audit.md` describes. Its model names
(`sonnet`, `opus`) may need mapping to the harness's models.

**Without one**, do the same pipeline by hand, one category at a time:

1. Recon: what runs in production here (for account-server: `auth/src`, `be/src`,
   `fe/src`, `fe/nginx.conf`, the three Dockerfiles, `infra/account-vm/deploy/`); which
   config wrappers can return a default (for account-server: `be/src/config/`, the
   `process.env` reads in `auth/src`).
2. Discover: for each category, read its `.json` and `.md`, grep the scope with the
   seed patterns plus patterns derived for this stack (`process.env.X ?? '...'`,
   `${VAR:-default}` in shell and compose files). Collect candidates, do not judge yet.
3. Verify: for each candidate start at "refuted" and walk the five steps in
   `README.md` ("How it runs"), stopping at the first that refutes it. An incomplete
   trace is refuted. Cite file and line, and the sink it reaches.
4. Report: the surviving findings with severity and the fix, the refuted ones with the
   step that refuted them, and which categories found no derived patterns (a coverage
   gap, not a clean result).

No candidates is a real result but not proof of absence; say so.
