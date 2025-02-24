import { InvalidDidError } from '../did-error.js'
import { Did, assertDidMsid } from '../did.js'

export const DID_WEB_PREFIX = `did:web:` satisfies Did<'web'>

/**
 * This function checks if the input is a valid Web DID, as per DID spec.
 */
export function isDidWeb(input: unknown): input is Did<'web'> {
  // Optimization: make cheap checks first
  if (typeof input !== 'string') return false
  if (!input.startsWith(DID_WEB_PREFIX)) return false
  if (input.charAt(DID_WEB_PREFIX.length) === ':') return false

  try {
    didWebToUrl(input as Did<'web'>)
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

  if (!input.startsWith(DID_WEB_PREFIX)) {
    throw new InvalidDidError(input, `Invalid did:web prefix`)
  }

  if (input.charAt(DID_WEB_PREFIX.length) === ':') {
    throw new InvalidDidError(input, 'did:web MSID must not start with a colon')
  }

  void didWebToUrl(input as Did<'web'>)
}

export function didWebToUrl(did: Did<'web'>) {
  // Make sure every char is valid (per DID spec)
  assertDidMsid(did, DID_WEB_PREFIX.length)

  const hostIdx = DID_WEB_PREFIX.length
  const pathIdx = did.indexOf(':', hostIdx)

  const host = pathIdx === -1 ? did.slice(hostIdx) : did.slice(hostIdx, pathIdx)
  const path = pathIdx === -1 ? '' : did.slice(pathIdx)

  try {
    const url = new URL(
      `https://${host.replaceAll('%3A', ':')}${path.replaceAll(':', '/')}`,
    ) as URL & { protocol: 'http:' | 'https:' }
    if (url.hostname === 'localhost') {
      url.protocol = 'http:'
    }
    return url
  } catch (cause) {
    throw new InvalidDidError(did, 'Invalid Web DID', cause)
  }
}

export function urlToDidWeb(url: URL): Did<'web'> {
  const port = url.port ? `%3A${url.port}` : ''
  const path = url.pathname === '/' ? '' : url.pathname.replaceAll('/', ':')

  return `did:web:${url.hostname}${port}${path}`
}
