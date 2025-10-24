import {
  OAuthClientIdDiscoverable,
  isLocalHostname,
  parseOAuthDiscoverableClientId,
} from '@atproto/oauth-types'
import { InvalidClientIdError } from '../errors/invalid-client-id-error.js'
import { InvalidRedirectUriError } from '../errors/invalid-redirect-uri-error.js'

export function parseRedirectUri(redirectUri: string): URL {
  try {
    return new URL(redirectUri)
  } catch (err) {
    throw InvalidRedirectUriError.from(err)
  }
}

export function parseDiscoverableClientId(
  clientId: OAuthClientIdDiscoverable,
): URL {
  try {
    const url = parseOAuthDiscoverableClientId(clientId)

    // Extra validation, prevent usage of invalid internet domain names.
    if (isLocalHostname(url.hostname)) {
      throw new InvalidClientIdError(
        "The client_id's TLD must not be a local hostname",
      )
    }

    return url
  } catch (err) {
    throw InvalidClientIdError.from(
      err,
      'Invalid discoverable client identifier',
    )
  }
}
