import { Jwks } from '@atproto-labs/jwk'
import {
  OAuthClientId,
  OAuthClientMetadata,
} from '@atproto-labs/oauth-client-metadata'
import { Awaitable } from '../util/awaitable.js'

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
