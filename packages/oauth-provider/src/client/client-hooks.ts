import { Jwks } from '@atproto/jwk'
import { OAuthClientId, OAuthClientMetadata } from '@atproto/oauth-types'

import { Awaitable } from '../lib/util/type.js'

/**
 * Use this to alter, override or validate the client metadata & jwks returned
 * by the client store.
 *
 * @throws {InvalidClientMetadataError} if the metadata is invalid
 * @see {@link InvalidClientMetadataError}
 */
export type ClientDataHook = (
  clientId: OAuthClientId,
  data: { metadata: OAuthClientMetadata; jwks?: Jwks },
) => Awaitable<void>

export type ClientHooks = {
  onClientData?: ClientDataHook
}
