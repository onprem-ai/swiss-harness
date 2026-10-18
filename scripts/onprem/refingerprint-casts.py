#!/usr/bin/env python3
"""Re-fingerprint scripts/no-unknown-casts.baseline.json after the scope rename.

Upstream's baseline hashes each `as unknown` assertion by its syntax tokens, which
include package names, so entries whose expression names `@deepseek-ai/...` change
hash under `@onprem-ai/...`. For every file whose cast COUNT is unchanged, this
replaces the entry's fingerprints with the current ones. It never adds a file or
raises a count, so the gate's intent, no new assertions, is preserved. Run after
`scripts/onprem/rebrand.sh` on a sync branch; then `pnpm run verify-no-unknown-casts`.
"""
import json, pathlib, subprocess, sys

root = pathlib.Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip())
path = root / 'scripts/no-unknown-casts.baseline.json'
base = json.loads(path.read_text())
cur = json.loads(subprocess.run(['node', '--import', 'tsx/esm', '-e', """
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as m from './scripts/verify-no-unknown-casts.ts'
const files = Object.keys(JSON.parse(readFileSync('scripts/no-unknown-casts.baseline.json','utf8')))
const casts = files.flatMap(f => { try { return m.findUnknownCasts(f, readFileSync(resolve(f),'utf8')) } catch { return [] } })
process.stdout.write(JSON.stringify(m.countUnknownCasts(casts)))
"""], cwd=root, capture_output=True, text=True, check=True).stdout)
changed, differing = 0, []
for file, counts in base.items():
    now = cur.get(file, {})
    if sum(counts.values()) == sum(now.values()):
        if set(counts) != set(now):
            base[file] = now; changed += 1
    else:
        differing.append(f'{file}: baseline {sum(counts.values())}, now {sum(now.values())}')
path.write_text(json.dumps(base, indent=2) + '\n')
print(f'refingerprint-casts: {changed} file(s) re-fingerprinted')
if differing:
    print('refingerprint-casts: cast count differs from baseline, left untouched (resolve by hand):', *differing, sep='\n  ')
    sys.exit(1)
