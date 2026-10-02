import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@onprem-ai/dsh-client-shortcuts',
  ['lib/types/index.js', 'lib/types/protocol.js'],
  { hostPhase: true },
)
