import { OAuthClientId, oauthClientIdSchema } from '@atproto/oauth-types'

import { isLoopbackHost, LoopbackHost } from '../lib/util/hostname.js'

export type ClientId = OAuthClientId
export const clientIdSchema = oauthClientIdSchema

/**
 * @see {@link https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html}
 */
export type DiscoverableClientId = ClientId & `https://${string}`

export function isDiscoverableClientId<C extends ClientId>(
  clientId: C,
): clientId is C & DiscoverableClientId {
  return clientId.startsWith('https://')
}

export type LoopbackClientId = ClientId &
  `http://${LoopbackHost}${'' | `${'/' | '?' | '#'}${string}`}`

export function isLoopbackClientId<C extends ClientId>(
  clientId: C,
): clientId is C & LoopbackClientId {
  try {
    const url = new URL(clientId)
    return url.protocol === 'http:' && isLoopbackHost(url.hostname)
  } catch {
    return false
  }
}
