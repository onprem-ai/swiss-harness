/** Explicit exceptions and Host packages for the published dependency policy. */

/** Packages treated as Client/Host packages without declaring `dsh.client`. */
const CLIENT_FACE_INCLUDE: readonly string[] = []

/** Packages exempted from automatic Client/Host treatment despite declaring `dsh.client`. */
const CLIENT_FACE_EXCLUDE: readonly string[] = [
  '@onprem-ai/dsh-api-session-controller',
  '@onprem-ai/dsh-api-workspace-controller',
]

/** Host-only packages whose peer relays are deliberately flattened. */
const HOST_DEPENDENCY_PACKAGES: readonly string[] = [
  '@onprem-ai/dsh-llm',
  '@onprem-ai/dsh-session',
]

/** Required Cordis services whose Host imports are type-only. */
const REQUIRED_SERVICE_PEERS = {
  '@onprem-ai/dsh-api-terminal-controller': ['@onprem-ai/dsh-subprocess'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Development-only package relationships not represented by source imports. */
const CONFIGURATION_ONLY_DEV_DEPENDENCIES = {
  '@onprem-ai/dsh-client-locale': ['@onprem-ai/dsh-api-remotes'],
  '@onprem-ai/dsh-client-ui-conversation': [
    '@onprem-ai/dsh-api-remotes',
    '@onprem-ai/dsh-client-ui-workspace',
  ],
  '@onprem-ai/dsh-client-ui-model-selection': ['@onprem-ai/dsh-client-ui-input-trigger'],
  '@onprem-ai/dsh-client-ui-sidebar': ['@onprem-ai/dsh-client-ui-workspace'],
  '@onprem-ai/dsh-client-ui-subagent': ['@onprem-ai/dsh-client-ui-input-trigger'],
  '@onprem-ai/dsh-client-ui-theme': ['@onprem-ai/dsh-api-remotes'],
  '@onprem-ai/dsh-client-ui-tool': ['@onprem-ai/dsh-api-remotes'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Workspace packages whose complete runtime surface is safe across duplicate installations. */
const DUPLICATE_SAFE_PACKAGES: readonly string[] = [
  '@onprem-ai/dsh-brand',
  '@onprem-ai/dsh-lazy-require',
  '@onprem-ai/dsh-typert-protocol',
  '@onprem-ai/dsh-util-code-language',
  '@onprem-ai/dsh-util-crypto',
  '@onprem-ai/dsh-util-values',
]

/**
 * Runtime exports whose values remain valid when npm installs another package copy.
 * New entries are forbidden by default. Automated agents must not add an
 * exception; every addition requires explicit human review and a dedicated,
 * prominent heading in the pull request description.
 */
const SAFE_HOST_DEPENDENCY_EXPORTS = {
  '@onprem-ai/dsh-credentials': ['credentialKey'],
  '@onprem-ai/dsh-deque': ['Deque'],
  '@onprem-ai/dsh-llm': ['callConfigEquals'],
  '@onprem-ai/dsh-session-format': ['sessionFormatLogFilename'],
  '@onprem-ai/dsh-timeout': ['MAX_TIMER_DELAY_MS'],
  '@onprem-ai/schemastery': ['default'],
} as const satisfies HostDependencyExports

/** Runtime exports that require every consumer to resolve the provider's shared peer instance. */
const PEER_REQUIRED_HOST_EXPORTS = {
  // `instanceof` checks need the translator's own class instance.
  '@onprem-ai/dsh-experimental-translator': ['TranslationError'],
  '@onprem-ai/dsh-scope': ['carrierKeyOf', 'createScope', 'scopeOf', 'scopeTarget'],
  '@onprem-ai/dsh-session': ['SESSION_FORMAT_VERSION'],
  '@onprem-ai/dsh-session-persistence': ['SessionPersistenceNotFoundError'],
} as const satisfies HostDependencyExports

/** Exact import specifier to reviewed runtime exports. */
type HostDependencyExports = Readonly<Record<string, readonly string[]>>

/** Complete configurable input to package dependency classification. */
export interface PackageDependencyPolicy {
  readonly clientFaceInclude: readonly string[]
  readonly clientFaceExclude: readonly string[]
  readonly hostPackages: readonly string[]
  readonly requiredServicePeers?: Readonly<Record<string, readonly string[]>>
  readonly configurationOnlyDevDependencies: Readonly<Record<string, readonly string[]>>
  readonly duplicateSafePackages?: readonly string[]
  readonly safeHostDependencyExports: HostDependencyExports
  readonly peerRequiredHostExports: HostDependencyExports
}

/** Repository dependency policy consumed by verification and benchmarking. */
export const PACKAGE_DEPENDENCY_POLICY: PackageDependencyPolicy = {
  clientFaceInclude: CLIENT_FACE_INCLUDE,
  clientFaceExclude: CLIENT_FACE_EXCLUDE,
  hostPackages: HOST_DEPENDENCY_PACKAGES,
  requiredServicePeers: REQUIRED_SERVICE_PEERS,
  configurationOnlyDevDependencies: CONFIGURATION_ONLY_DEV_DEPENDENCIES,
  duplicateSafePackages: DUPLICATE_SAFE_PACKAGES,
  safeHostDependencyExports: SAFE_HOST_DEPENDENCY_EXPORTS,
  peerRequiredHostExports: PEER_REQUIRED_HOST_EXPORTS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a package manifest declares a dynamically loaded Client entry. */
export function hasClientDeclaration(dshField: unknown): boolean {
  return isRecord(dshField) && Object.hasOwn(dshField, 'client')
}
