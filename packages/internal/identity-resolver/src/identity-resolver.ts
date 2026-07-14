import type { AtprotoDid, AtprotoDidDocument } from '@atproto-labs/did-resolver'
import type { HANDLE_INVALID } from './constants.js'

export type { AtprotoDid, AtprotoDidDocument }

// Consistent with `com.atproto.identity.defs#identityInfo` returned by
// `com.atproto.identity.resolveIdentity` endpoint.
export type IdentityInfo = {
  did: AtprotoDid
  didDoc: AtprotoDidDocument

  /**
   * Will be 'handle.invalid' if the handle does not resolve to the
   * same DID as the input, or if the handle is not present in the DID
   * document.
   */
  handle: typeof HANDLE_INVALID | string
}

export type ResolveIdentityOptions = {
  signal?: AbortSignal
  noCache?: boolean
}

export interface IdentityResolver {
  resolve(
    identifier: string,
    options?: ResolveIdentityOptions,
  ): Promise<IdentityInfo>
}
