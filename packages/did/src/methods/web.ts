import { InvalidDidError } from '../did-error.js'
import { Did, assertDidMsid } from '../did.js'
import { canParse } from '../lib/uri.js'

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
    assertDidMsid(input, DID_WEB_PREFIX.length)
  } catch {
    return false
  }

  return canParse(buildDidWebUrl(input as Did<'web'>))
}

export function asDidWeb<T>(input: T) {
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

  // Make sure every char is valid (per DID spec)
  assertDidMsid(input, DID_WEB_PREFIX.length)

  if (!canParse(buildDidWebUrl(input as Did<'web'>))) {
    throw new InvalidDidError(input, 'Invalid Web DID')
  }
}

export function didWebToUrl(did: Did<'web'>) {
  try {
    return new URL(buildDidWebUrl(did)) as URL & {
      protocol: 'http:' | 'https:'
    }
  } catch (cause) {
    throw new InvalidDidError(did, 'Invalid Web DID', cause)
  }
}

export function urlToDidWeb(url: URL): Did<'web'> {
  const port = url.port ? `%3A${url.port}` : ''
  const path = url.pathname === '/' ? '' : url.pathname.replaceAll('/', ':')

  return `did:web:${url.hostname}${port}${path}`
}

export function buildDidWebUrl(did: Did<'web'>): string {
  const hostIdx = DID_WEB_PREFIX.length
  const pathIdx = did.indexOf(':', hostIdx)

  const hostEnc =
    pathIdx === -1 ? did.slice(hostIdx) : did.slice(hostIdx, pathIdx)
  const host = hostEnc.replaceAll('%3A', ':')
  const path = pathIdx === -1 ? '' : did.slice(pathIdx).replaceAll(':', '/')
  const proto =
    host.startsWith('localhost') &&
    (host.length === 9 || host.charCodeAt(9) === 58) /* ':' */
      ? 'http'
      : 'https'

  return `${proto}://${host}${path}`
}
