/**
 * Make a `pnpm deploy` output self-contained for the container image: replace
 * workspace links with files, share duplicated workspace packages, and fail
 * when any link still points outside the payload.
 */
import { lstat, readdir, readlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { deduplicateStagedWorkspacePackages, materializeStagedLinks } from '../scripts/build-exe-for-python-sdk-staging.ts'

async function links(directory: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink()) found.push(`${path} -> ${await readlink(path)}`)
    else if (metadata.isDirectory()) found.push(...await links(path))
  }
  return found
}

const [staging, workspace] = process.argv.slice(2)
if (staging === undefined || workspace === undefined) {
  throw new Error('usage: tsx docker/stage.ts <deployed-dir> <workspace-root>')
}
await materializeStagedLinks(resolve(staging))
await deduplicateStagedWorkspacePackages(resolve(staging), resolve(workspace))
const remaining = await links(resolve(staging, 'node_modules'))
if (remaining.length > 0) throw new Error(`docker/stage: links remain:\n${remaining.join('\n')}`)
