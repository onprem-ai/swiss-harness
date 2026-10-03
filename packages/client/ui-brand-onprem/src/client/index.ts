/** Swiss Harness occupants for the generic browser-brand slots. */
import type { Context as ClientContext } from '@onprem-ai/cordis'
import type {} from '@onprem-ai/dsh-client-ui-renderer/client'
import type {} from '@onprem-ai/dsh-client-ui-sidebar/client'
import type {} from '@onprem-ai/dsh-client-ui-conversation/client'
import { HeroBrandMark, SidebarBrandMark, SidebarBrandName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill the sidebar brand slots as one declaration-aware registration set, and
 * the conversation hero mark as a second, independently declared set. Unlike
 * the upstream official package this registers in every client build: the
 * deployment's identity does not depend on a build-time profile.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SidebarBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, SidebarBrandName)
    }))
  ctx.slots.inject('conversation.hero.brand.mark', () =>
    ctx.slots.register({ name: 'conversation.hero.brand.mark' }, HeroBrandMark))
}
