import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@onprem-ai/dsh-api-workspace-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
