import { Context } from '@onprem-ai/cordis'
import Sandbox from '@onprem-ai/dsh-sandbox-local'
import SandboxPolicy from '@onprem-ai/dsh-sandbox-policy'
import SessionProjections from '@onprem-ai/dsh-session-projection'
import { onTestFinished } from 'vitest'
import type { SandboxMode } from '@onprem-ai/dsh-sandbox'

/** Mount the Python runtime's policy and confinement providers with owned teardown. */
export async function createRuntimeContext(policy: { mode?: SandboxMode; workspaceRoot?: string } = {}): Promise<Context> {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  return ctx
}
