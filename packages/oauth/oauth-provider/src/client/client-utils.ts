import { isIp } from '@atproto-labs/fetch'

import { InvalidClientIdError } from '../errors/invalid-client-id-error.js'
import { InvalidRedirectUriError } from '../errors/invalid-redirect-uri-error.js'
import { isInternetHost, isLoopbackHost } from '../lib/util/hostname.js'
import {
  ClientId,
  DiscoverableClientId,
  LoopbackClientId,
} from './client-id.js'

export function parseRedirectUri(redirectUri: string): URL {
  try {
    return new URL(redirectUri)
  } catch (err) {
    throw InvalidRedirectUriError.from(err)
  }
}

function parseClientIdUrl(clientId: ClientId): URL {
  try {
    const url = new URL(clientId)

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new InvalidClientIdError(
        'ClientID must use the "https:" or "http:" protocol',
      )
    }

    url.searchParams.sort()

    const canonicalUri =
      url.pathname === '/' ? url.origin + url.search : url.href
    if (canonicalUri !== clientId) {
      throw new InvalidClientIdError(
        `ClientID must be in canonical form ("${canonicalUri}")`,
      )
    }

    return url
  } catch (err) {
    throw InvalidClientIdError.from(err)
  }
}

export function parseDiscoverableClientId(clientId: DiscoverableClientId): URL {
  const url = parseClientIdUrl(clientId)

  // Optimization: cheap checks first

  if (url.protocol !== 'https:') {
    throw new InvalidClientIdError('ClientID must use the "https:" protocol')
  }

  if (url.hash) {
    throw new InvalidClientIdError('ClientID must not contain a fragment')
  }

  if (url.username || url.password) {
    throw new InvalidClientIdError('ClientID must not contain credentials')
  }

  if (url.pathname === '/') {
    throw new InvalidClientIdError(
      'ClientID must contain a path (e.g. "/client-metadata")',
    )
  }

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    throw new InvalidClientIdError(
      'ClientID must not end with a trailing slash',
    )
  }

  if (url.pathname.includes('//')) {
    throw new InvalidClientIdError(
      `ClientID must not contain any double slashes in its path`,
    )
  }

  // Note: Query string is allowed
  // Note: no restriction on the port for non-loopback URIs

  if (isLoopbackHost(url.hostname)) {
    throw new InvalidClientIdError('ClientID must not be a loopback hostname')
  }

  if (isIp(url.hostname)) {
    throw new InvalidClientIdError('ClientID must not be an IP address')
  }

  if (!isInternetHost(url.hostname)) {
    throw new InvalidClientIdError('ClientID is not a valid internet address')
  }

  return url
}

export function parseLoopbackClientId(clientId: LoopbackClientId): URL {
  const url = parseClientIdUrl(clientId)

  // Optimization: cheap checks first

  if (url.protocol !== 'http:') {
    throw new InvalidClientIdError(
      'Loopback ClientID must use the "http:" protocol',
    )
  }

  if (url.hostname !== 'localhost') {
    throw new InvalidClientIdError(
      'Loopback ClientID must use the "localhost" hostname',
    )
  }

  if (url.hash) {
    throw new InvalidClientIdError(
      'Loopback ClientID must not contain a fragment',
    )
  }

  if (url.username || url.password) {
    throw new InvalidClientIdError(
      'Loopback ClientID must not contain credentials',
    )
  }

  if (url.port) {
    throw new InvalidClientIdError('Loopback ClientID must not contain a port')
  }

  // Note: url.pathname === '/' is allowed for loopback URIs

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    throw new InvalidClientIdError(
      'Loopback ClientID must not end with a trailing slash',
    )
  }

  if (url.pathname.includes('//')) {
    throw new InvalidClientIdError(
      `Loopback ClientID must not contain any double slashes in its path`,
    )
  }

  // Note: Query string is allowed

  return url
}
