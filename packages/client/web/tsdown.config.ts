import { staticLinked } from '../tsdown.client.ts'

export default staticLinked(
  '@onprem-ai/dsh-client-web',
  ['lib/types/index.js', 'lib/types/apply-injections.js'],
)
