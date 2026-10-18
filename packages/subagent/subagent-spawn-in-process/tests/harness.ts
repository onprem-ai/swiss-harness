import { mountWorkingDirectoryFixture } from '../../subagent/tests/working-directory-fixture.ts'
import { join } from 'node:path'
import * as JsonlSessionPersistence from '@onprem-ai/dsh-session-persistence-jsonl'
import { Context } from '@onprem-ai/cordis'
import type { Agent } from '@onprem-ai/dsh-agent'
import AgentLoop from '@onprem-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@onprem-ai/dsh-agent-loop-testkit'
import { LocalBashExecutor } from '@onprem-ai/dsh-bash-local'
import * as BashEnvPlugin from '@onprem-ai/dsh-shell-env'
import LocalSubprocessRuntime from '@onprem-ai/dsh-subprocess-local'
import * as ToolBash from '@onprem-ai/dsh-tool-bash'
import * as LlmDeepSeek from '@onprem-ai/dsh-llm-deepseek-api-key'
import SubagentRuntime from '@onprem-ai/dsh-subagent'
import * as Spawn from '../src/index.ts'
import * as ToolSubagent from '@onprem-ai/dsh-tool-subagent'

/**
 * Shared harness for the spawn-backend e2e: the full real stack (DeepSeek
 * adapter + real bash tool + the subagent tool bound to the spawn backend), so
 * a real parent agent can delegate to a real in-process child that does real
 * work (writes a file). Lives outside the *.e2e.ts pattern so importing it never
 * re-registers another file's tests.
 */
export async function spawnHarness(workdir: string): Promise<Context> {
  const ctx = new Context()
  // This harness installs only the global default persona, so both parent and
  // spawned children render it. It stays neutral for both roles; the
  // delegation nudge lives in the e2e's user prompt and the subagent tool's
  // own description.
  await mountAgentLoopTestDependencies(ctx, {
    workingDirectory: true,
    systemPrompt: { personaPrefix: 'You are a coding agent. Report only when the requested work is done.' },
  })
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(LlmDeepSeek)
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(BashEnvPlugin)
  await ctx.plugin(LocalBashExecutor, { cwd: workdir, timeoutMs: 30_000 })
  await ctx.plugin(ToolBash)
  await ctx.plugin(JsonlSessionPersistence, { root: join(workdir, '.sessions') })
  await mountWorkingDirectoryFixture(ctx)
  await ctx.plugin(SubagentRuntime)
  await ctx.plugin(Spawn, { providerName: 'spawn' })
  // The model-facing subagent tool, bound to the spawn backend.
  await ctx.plugin(ToolSubagent, { provider: 'spawn' })
  return ctx
}

export async function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  do {
    await agent.whenIdle()
  } while (await ctx.subagents.waitForChildren(agent))
}
