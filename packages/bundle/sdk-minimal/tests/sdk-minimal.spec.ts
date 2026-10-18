/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@onprem-ai/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('dsh-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@onprem-ai/dsh-sdk-app'],
      ['sdk-jsonrpc-server', '@onprem-ai/dsh-sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@onprem-ai/dsh-deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@onprem-ai/dsh-session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@onprem-ai/dsh-plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@onprem-ai/dsh-llm-deepseek-api-key'],
      ['sandbox', '@onprem-ai/dsh-sandbox-local'],
      ['filesystem', '@onprem-ai/dsh-fs-local'],
      ['attachment-local', '@onprem-ai/dsh-attachment-local'],
      ['tool-fs', '@onprem-ai/dsh-tool-fs'],
      ['working-directory', '@onprem-ai/dsh-working-directory'],
      ['tool-working-directory', '@onprem-ai/dsh-tool-working-directory'],
      ['session-projection', '@onprem-ai/dsh-session-projection'],
      ['token-meter', '@onprem-ai/dsh-token-meter'],
      ['compaction-basic', '@onprem-ai/dsh-compaction-basic'],
      ['image-offload', '@onprem-ai/dsh-compaction-image-offload'],
      ['sandbox-policy', '@onprem-ai/dsh-sandbox-policy'],
      ['subprocess', '@onprem-ai/dsh-subprocess-local'],
      ['pty', '@onprem-ai/dsh-terminal'],
      ['terminal-bash', '@onprem-ai/dsh-terminal-bash'],
      ['terminal-pwsh', '@onprem-ai/dsh-terminal-bash'],
      ['timer', '@onprem-ai/cordis-plugin-timer'],
      ['llm', '@onprem-ai/dsh-llm'],
      ['session', '@onprem-ai/dsh-session'],
      ['session-title', '@onprem-ai/dsh-session-title'],
      ['system-prompt', '@onprem-ai/dsh-system-prompt'],
      ['tools', '@onprem-ai/dsh-tools'],
      ['mcp-resources', '@onprem-ai/dsh-mcp-resources'],
      ['agent', '@onprem-ai/dsh-agent'],
      ['llm-retry', '@onprem-ai/dsh-llm-retry'],
      ['jobs', '@onprem-ai/dsh-jobs-local'],
      ['agent-loop', '@onprem-ai/dsh-agent-loop'],
      ['persistent-bash', '@onprem-ai/dsh-tool-bash-persistent'],
      ['persistent-pwsh', '@onprem-ai/dsh-tool-pwsh-persistent'],
      ['sessions', '@onprem-ai/dsh-session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-deepseek')?.config).toEqual({
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.DSH_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      personaPrefix: { __jsExpr: "process.env.DSH_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'tool-fs')?.config).toEqual({ read: false, readImage: true, write: false, edit: false })
    expect(rows.find(row => row.id === 'compaction-basic')?.config).toBeUndefined()
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
