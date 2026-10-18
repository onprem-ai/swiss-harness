/** Real Loader composition: the bridge mounted from a cordis.yml row beside the shipped core plugins. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@onprem-ai/cordis'
import Loader from '@onprem-ai/cordis-plugin-loader'
import Include from '@onprem-ai/cordis-plugin-include'
import AgentRegistry from '@onprem-ai/dsh-agent'
import AgentLoop from '@onprem-ai/dsh-agent-loop'
import CommandRuntime from '@onprem-ai/dsh-commands'
import LocalFileSystem from '@onprem-ai/dsh-fs-local'
import WorkingDirectory from '@onprem-ai/dsh-working-directory'
import LlmRuntime, { createUserMessage } from '@onprem-ai/dsh-llm'
import SessionStore, { SessionId } from '@onprem-ai/dsh-session'
import SessionProjectionRegistry from '@onprem-ai/dsh-session-projection'
import SystemPrompt from '@onprem-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@onprem-ai/dsh-tools'
import * as ClaudeCodeMods from '../src/index.ts'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const FIXTURES = resolve(import.meta.dirname, 'fixtures')

let ctx: Context | undefined
let root: string | undefined

afterEach(async () => {
  await ctx?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  ctx = undefined
  root = undefined
})

it('loads from cordis.yml, counts the model\'s tool calls, and answers /tally through the composed command registry', async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-cc-mods-composition-'))
  const configPath = join(root, 'cordis.yml')
  const modules = new Map<string, unknown>([
    ['@onprem-ai/dsh-llm', LlmRuntime],
    ['@onprem-ai/dsh-session', SessionStore],
    ['@onprem-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@onprem-ai/dsh-system-prompt', SystemPrompt],
    ['@onprem-ai/dsh-fs-local', LocalFileSystem],
    ['@onprem-ai/dsh-working-directory', WorkingDirectory],
    ['@onprem-ai/dsh-tools', ToolRuntime],
    ['@onprem-ai/dsh-agent', AgentRegistry],
    ['@onprem-ai/dsh-agent-loop', AgentLoop],
    ['@onprem-ai/dsh-commands', CommandRuntime],
    ['@onprem-ai/dsh-experimental-claude-code-mods', ClaudeCodeMods],
  ])
  // A mod is a plugin like any other: here the tutorial mod's `defineMod` wrapper, mounted by file URL after the bridge.
  const firstMod = pathToFileURL(resolve(FIXTURES, 'first-mod.ts')).href
  await writeFile(configPath, [
    ...[...modules.keys()].map(name => `- name: '${name}'`),
    `- name: '${firstMod}'`,
    '  config:',
    '    greeting: The model made',
  ].join('\n') + '\n')

  const context = ctx = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  // Without a Node internal loader the Loader imports bare names through this
  // test runner's module graph, which resolves workspace packages to `src`.
  context.loader.internal = undefined
  await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await context.loader.await()
  for (const entry of context.loader.entries()) await entry.fiber?.await()

  const adapter = new MockAdapter([toolCallResponse('c1', 'echo', { command: 'ls' }), textResponse('listed')])
  context.llm.registerAdapter(['mock'], adapter)
  context.tools.register(defineContentToolFixture({
    name: 'echo', description: 'echo', parameters: { command: { type: 'string' } },
    async execute(args) { return [{ type: 'text', text: `ran ${args.command}` }] },
  }))
  const agent = await context.agentLoop.create(SessionId('composed'), { provider: 'mock', model: 'mock' })
  expect(context.commands.list(agent).map(command => command.name)).toEqual(['tally'])
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'list the files here' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(adapter.requests).toHaveLength(2)
  const run = await context.commands.execute(agent, '/tally', [], new AbortController().signal)
  expect(run?.result).toEqual({ kind: 'success', text: 'first-mod: The model made 1 tool calls since this mod loaded' })
})
