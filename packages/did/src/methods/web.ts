import { InvalidDidError } from '../did-error.js'
import { Did, assertDidMsid } from '../did.js'

export const DID_WEB_PREFIX = `did:web:` satisfies Did<'web'>

/**
 * This function checks if the input is a valid Web DID, as per DID spec.
 */
export function isDidWeb(input: unknown): input is Did<'web'> {
  // Optimization: make cheap checks first
  if (typeof input !== 'string') return false

  try {
    assertDidWeb(input)
    return true
  } catch {
    return false
  }
}

export function asDidWeb(input: unknown): Did<'web'> {
  assertDidWeb(input)
  return input
}

export function assertDidWeb(input: unknown): asserts input is Did<'web'> {
  if (typeof input !== 'string') {
    throw new InvalidDidError(typeof input, `DID must be a string`)
  }

  void didWebToUrl(input)
}

export function didWebToUrl(did: string): URL {
  if (!did.startsWith(DID_WEB_PREFIX)) {
    throw new InvalidDidError(did, `did:web must start with ${DID_WEB_PREFIX}`)
  }

  if (did.charAt(DID_WEB_PREFIX.length) === ':') {
    throw new InvalidDidError(did, 'did:web MSID must not start with a colon')
  }

  // Make sure every char is valid (per DID spec)
  assertDidMsid(did, DID_WEB_PREFIX.length)

  try {
    const msid = did.slice(DID_WEB_PREFIX.length)
    const parts = msid.split(':').map(decodeURIComponent)
    const url = new URL(`https://${parts.join('/')}`)
    if (url.hostname === 'localhost') {
      url.protocol = 'http:'
    }
    return url
  } catch (cause) {
    throw new InvalidDidError(did, 'Invalid Web DID', cause)
  }
}

export function urlToDidWeb(url: URL): Did<'web'> {
  const path =
    url.pathname === '/'
      ? ''
      : url.pathname.slice(1).split('/').map(encodeURIComponent).join(':')

  return `did:web:${encodeURIComponent(url.host)}${path ? `:${path}` : ''}`
}
