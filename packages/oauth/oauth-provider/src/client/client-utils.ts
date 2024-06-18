import {
  OAuthClientIdDiscoverable,
  OAuthClientIdLoopback,
  parseOAuthLoopbackClientId,
  parseOAuthDiscoverableClientId,
} from '@atproto/oauth-types'

import { InvalidClientIdError } from '../errors/invalid-client-id-error.js'
import { InvalidRedirectUriError } from '../errors/invalid-redirect-uri-error.js'
import { isInternetHost } from '../lib/util/hostname.js'

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
    if (!isInternetHost(url.hostname)) {
      throw new InvalidClientIdError('ClientID is not a valid internet address')
    }

    return url
  } catch (err) {
    throw InvalidClientIdError.from(err)
  }
}

export function parseLoopbackClientId(clientId: OAuthClientIdLoopback): URL {
  try {
    return parseOAuthLoopbackClientId(clientId)
  } catch (err) {
    throw InvalidClientIdError.from(err)
  }
}
