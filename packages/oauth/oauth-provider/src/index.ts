/**
 * @deprecated Use the individual entry points defined in package.json "exports"
 * field instead. This file is kept for backwards compatibility.
 */

// Avoid having to explicitly depend sub dependencies
export * from '@atproto-labs/fetch-node'
export * from '@atproto/jwk'
export * from '@atproto/jwk-jose'
export * from '@atproto/oauth-types'

// Was ./oauth-client.js
export * from '@atproto/oauth-types'
export type * from './client/client.js'
export * from './client/client-utils.js'

// Was ./oauth-dpop.js
export * from './dpop/dpop-nonce.js'
export * from './dpop/dpop-manager.js'

export * from './oauth-constants.js'
export * from './oauth-errors.js'
export * from './oauth-hooks.js'
export * from './oauth-middleware.js'
export * from './oauth-provider.js'
export * from './oauth-store.js'
export * from './oauth-verifier.js'
