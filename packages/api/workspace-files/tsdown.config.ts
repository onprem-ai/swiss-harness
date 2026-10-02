import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@onprem-ai/dsh-api-workspace-files',
  ['lib/types/index.js'],
  { hostPhase: true },
)
