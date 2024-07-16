import { InvalidDidError } from '../did-error.js'
import { Did, checkDidMsid } from '../did.js'

export const DID_WEB_PREFIX = `did:web:`

/**
 * This function checks if the input is a valid Web DID, as per DID spec.
 * ATPROTO adds additional constraints to allowed DID values for the `did:web`
 * method. Use {@link isAtprotoDidWeb} if that's what you need.
 */
export function isDidWeb(input: unknown): input is Did<'web'> {
  if (typeof input !== 'string') return false
  try {
    didWebToUrl(input)
    return true
  } catch {
    return false
  }
}

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export function isAtprotoDidWeb(input: unknown): input is Did<'web'> {
  // Optimization: make cheap checks first
  if (typeof input !== 'string') {
    return false
  }

  // Path are not allowed
  if (input.includes(':', DID_WEB_PREFIX.length)) {
    return false
  }

  // Port numbers are not allowed, except for localhost
  if (
    input.includes('%3A', DID_WEB_PREFIX.length) &&
    !input.startsWith('did:web:localhost%3A')
  ) {
    return false
  }

  return isDidWeb(input)
}

export function checkDidWeb(input: string): asserts input is Did<'web'> {
  didWebToUrl(input)
}

export function didWebToUrl(did: string): URL {
  if (!did.startsWith(DID_WEB_PREFIX)) {
    throw new InvalidDidError(did, `did:web must start with ${DID_WEB_PREFIX}`)
  }

  if (did.charAt(DID_WEB_PREFIX.length) === ':') {
    throw new InvalidDidError(did, 'did:web MSID must not start with a colon')
  }

  // Make sure every char is valid (per DID spec)
  checkDidMsid(did, DID_WEB_PREFIX.length)

  try {
    const msid = did.slice(DID_WEB_PREFIX.length)
    const parts = msid.split(':').map(decodeURIComponent)
    return new URL(`https://${parts.join('/')}`)
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
