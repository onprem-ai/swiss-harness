/**
 * The bundle's substance is its patch file. These tests pin the three
 * guarantees the layer makes over base + web-app: every row it targets
 * exists (no loader warnings), every vendor-egress row ends disabled, and
 * the model route is the environment-described on-premises endpoint.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@onprem-ai/cordis-plugin-include'
import { evaluate as evaluateExpression } from '@onprem-ai/cordis-plugin-loader'
import type { PatchOptions } from '@onprem-ai/cordis-plugin-include'
import { composeEntries } from '@onprem-ai/dsh-app-boot'

const root = fileURLToPath(new URL('..', import.meta.url))

/** The loader evaluator, typed as the untyped JSON it yields. */
const evaluate: (scope: object, expression: string) => JsonValue = evaluateExpression
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function layer(packageDir: string): PatchOptions[] {
  const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')) as {
    dsh?: { bundle?: { patch?: string | string[] } }
  }
  const patch = manifest.dsh?.bundle?.patch
  const files = patch === undefined ? [] : Array.isArray(patch) ? patch : [patch]
  return files.flatMap((file) => {
    const parsed = yaml.load(readFileSync(resolve(packageDir, file), 'utf8'), { schema: entryListSchema })
    if (!Array.isArray(parsed)) throw new TypeError(`${file} must parse to a patch list`)
    return parsed as PatchOptions[]
  })
}

const base = () => layer(resolve(root, '../base'))
const webApp = () => layer(resolve(root, '../web-app'))
const onprem = () => layer(root)

/** Rows the vendor-egress policy must leave disabled. */
const EGRESS_ROWS = [
  'session-telemetry-otel',
  'desktop-product-telemetry',
  'product-analytics',
  'deepseek-account',
  'account-controller',
  'ui-settings-account',
  'llm-deepseek-account',
  'deepseek-llm-api-extensions',
  'session-log-deepseek',
  'plugin-package-inventory-deepseek',
  'llm-deepseek',
  'web-search-deepseek',
  'web-deepseek-api',
  'message-feedback',
  'ui-message-feedback',
  'command-feedback',
  'ui-brand-official',
] as const

function composed(env: Record<string, string | undefined> = {}) {
  const warnings: string[] = []
  const rows = composeEntries([base(), webApp(), onprem()], message => warnings.push(message))
  const scope = { process: { env, platform: process.platform }, ctx: { get: () => undefined } }
  const value = (row: { config?: unknown }, key: string): unknown => {
    const config = row.config as Record<string, unknown> | undefined
    const field = config?.[key]
    return field !== null && typeof field === 'object' && '__jsExpr' in field
      ? evaluate(scope, (field as { __jsExpr: string }).__jsExpr)
      : field
  }
  return { rows, warnings, value, row: (id: string) => rows.find(entry => entry.id === id) }
}

afterEach(() => { vi.unstubAllEnvs() })

describe('dsh-onprem-app bundle', () => {
  it('declares a parseable patch list through the dsh.bundle.patch manifest field', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
      dependencies?: Record<string, string>
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(onprem().length).toBeGreaterThan(10)
    // The brand occupant this layer inserts must resolve from this bundle.
    expect(manifest.dependencies).toHaveProperty('@onprem-ai/dsh-client-ui-brand-onprem')
  })

  it('targets only rows base and web-app insert, so composition emits no warnings', () => {
    expect(composed().warnings).toEqual([])
  })

  it('leaves every vendor-egress row disabled', () => {
    const { row } = composed()
    for (const id of EGRESS_ROWS) {
      expect(row(id), id).toBeDefined()
      expect(row(id)?.disabled, id).toBe(true)
    }
  })

  it('pins the plugin manager to the operator registry with no public fallback', () => {
    const { row, value } = composed({ DSH_PLUGIN_REGISTRY: 'https://npm.internal/' })
    expect(value(row('plugin-manager')!, 'registry')).toBe('https://npm.internal/')
    expect(row('plugin-manager')?.config).toMatchObject({ fallbackRegistries: [] })
  })

  it('routes the default model to the environment-described on-premises endpoint', () => {
    const env = {
      ONPREM_LLM_BASE_URL: 'http://vllm.internal:8000/v1',
      ONPREM_LLM_MODEL: 'qwen3-32b',
      ONPREM_LLM_API_KEY: 'set',
      ONPREM_LLM_CONTEXT: '65536',
    }
    const { row, value } = composed(env)
    expect(row('agent-default-model')?.config).toMatchObject({ provider: 'onprem' })
    expect(value(row('agent-default-model')!, 'model')).toBe('qwen3-32b')
    expect(value(row('llm-pi-ai')!, 'providers')).toEqual({
      onprem: {
        displayName: 'On-premises model',
        api: 'openai-completions',
        baseURL: 'http://vllm.internal:8000/v1',
        apiKeyEnv: 'ONPREM_LLM_API_KEY',
        models: [{ id: 'qwen3-32b', contextWindow: 65536 }],
      },
    })
  })

  it('sends a placeholder Authorization header for an unauthenticated endpoint and no route without an endpoint', () => {
    const keyless = composed({ ONPREM_LLM_BASE_URL: 'http://ollama.internal:11434/v1' })
    const providers = keyless.value(keyless.row('llm-pi-ai')!, 'providers')
    expect(providers).toMatchObject({
      onprem: {
        models: [{ id: 'default', contextWindow: 131072 }],
        headers: { Authorization: expect.stringMatching(/^Bearer /u) as string },
      },
    })
    expect(JSON.stringify(providers)).not.toContain('apiKeyEnv')
    const unset = composed({})
    expect(unset.value(unset.row('llm-pi-ai')!, 'providers')).toEqual({})
  })

  it('keeps fetch and drops the vendor search provider', () => {
    const { row } = composed()
    expect(row('web')?.config).toEqual({ fetchProvider: 'http' })
    const fetchConfig = row('web-fetch-http')?.config as { userAgent?: string } | undefined
    expect(fetchConfig?.userAgent).toMatch(/^swiss-harness\//u)
  })

  it('selects browser authentication from DSH_WEB_AUTH and keeps the invocation trusted hosts', () => {
    const scope = (env: Record<string, string>) => ({
      process: { env },
      ctx: { webStartup: { trustedHosts: ['app.example'] } },
    })
    const { row } = composed()
    const config = row('connection')?.config as Record<string, { __jsExpr: string }>
    expect(evaluate(scope({}), config.trustedHosts!.__jsExpr)).toEqual(['app.example'])
    expect(evaluate(scope({}), config.browserAuthentication!.__jsExpr)).toBe('launch-token')
    expect(evaluate(scope({ DSH_WEB_AUTH: 'trusted-proxy' }), config.browserAuthentication!.__jsExpr)).toBe('trusted-proxy')
  })

  it('replaces the brand occupant row', () => {
    const { rows } = composed()
    expect(rows.filter(entry => entry.name === '@onprem-ai/dsh-client-ui-brand-onprem')).toEqual([
      { id: 'ui-brand-onprem', name: '@onprem-ai/dsh-client-ui-brand-onprem' },
    ])
  })

  it('never names a vendor hostname in a value that survives composition', () => {
    const text = JSON.stringify(composed().rows.filter(row => row.disabled !== true))
    expect(text).not.toMatch(/deepseek(svc)?\.com/u)
    expect(text).not.toMatch(/npmmirror\.com/u)
  })
})
