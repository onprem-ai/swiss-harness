# Third-party skills in this directory

Three skills here are copied from Trail of Bits, pinned to one upstream commit. They are
vendored (copied, not installed as plugins) so the version is fixed, reviewed in our
diffs, and readable by any agent from the repository alone. Copied into this repository
on 2026-10-18 from onprem-ai/account-server, where the same three live at the same pin.

| | |
|---|---|
| Source | https://github.com/trailofbits/skills |
| Commit | `5c99c03fb8a9ea568432ecbcba5d86e9f4ac2bf0` (2026-10-15) |
| Copied | 2026-10-17, by Tomas Polach with Tino Baechtold |
| License | CC BY-SA 4.0, full text in `LICENSE-trailofbits-skills.txt`. Changes to these files stay under CC BY-SA 4.0 and keep this attribution. |
| Vetting | Trail of Bits' own marketplace, listed as approved in https://github.com/trailofbits/skills-curated. We read every script before copying: no hooks; only `supply-chain-risk-auditor/scripts/` executes code (Python standard library, no dependencies). |

## What came from where

| Here | Upstream path (at the commit above) | Plugin version |
|---|---|---|
| `supply-chain-risk-auditor/` | `plugins/supply-chain-risk-auditor/skills/supply-chain-risk-auditor/` | 2.0.4 |
| `differential-review/` | `plugins/differential-review/skills/differential-review/` | 1.1.4 |
| `differential-review/agents/adversarial-modeler.md` | `plugins/differential-review/agents/adversarial-modeler.md` | 1.1.4 |
| `insecure-defaults/` (`README.md`, `commands/`, `workflows/`, `references/`) | `plugins/insecure-defaults/` | 2.0.3 |

Left out: each plugin's `.claude-plugin/plugin.json` and `README.md` (except
insecure-defaults', which documents the method), upstream's own tests and evals
(`scripts/test_*.py`, `evals/`, `insecure-defaults/tests/`), and
`differential-review/commands/diff-review.md` (it only forwards to the skill).

## Local changes

Upstream files are byte-for-byte unchanged. Added by us:

- `insecure-defaults/SKILL.md`: upstream ships this one as a plugin command plus a
  workflow script with no `SKILL.md`; ours makes it discoverable as a skill and
  describes the same pipeline for agents without a workflow tool.
- This file.

Differences from the plugin install an agent should know:

- `differential-review` names its subagent `differential-review:adversarial-modeler`.
  That name exists only when installed as a plugin. Here, use
  `differential-review/agents/adversarial-modeler.md` as the subagent's prompt.
- `{baseDir}` and `${CLAUDE_PLUGIN_ROOT}` in upstream files mean that skill's
  directory here (for example `.agents/skills/supply-chain-risk-auditor`).
- Reports go outside the repository (for example `/tmp/`), never into the working tree,
  unless a person asks to keep one; a kept report belongs under `.agents/notes/`.

## Updating

Take a newer commit deliberately, in its own change, and read the diff of every script
before committing. To check this copy against the pin, or to update it, re-run the copy
and look at `git diff`:

```sh
git clone https://github.com/trailofbits/skills /tmp/tob-skills
git -C /tmp/tob-skills checkout <commit>
S=/tmp/tob-skills/plugins D=.agents/skills
cp -r $S/supply-chain-risk-auditor/skills/supply-chain-risk-auditor/{SKILL.md,scripts,agents,assets} $D/supply-chain-risk-auditor/
rm -f $D/supply-chain-risk-auditor/scripts/test_*.py
cp -r $S/differential-review/skills/differential-review/{SKILL.md,methodology.md,adversarial.md,patterns.md,reporting.md,agents,assets} $D/differential-review/
cp $S/differential-review/agents/adversarial-modeler.md $D/differential-review/agents/
cp -r $S/insecure-defaults/{README.md,commands,workflows,references} $D/insecure-defaults/
cp /tmp/tob-skills/LICENSE $D/LICENSE-trailofbits-skills.txt
git diff --stat .claude/skills    # empty at the pinned commit
```

Then update the commit, date and plugin versions in this file.
