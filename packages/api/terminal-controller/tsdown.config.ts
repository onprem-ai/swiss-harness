import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@onprem-ai/dsh-api-terminal-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
