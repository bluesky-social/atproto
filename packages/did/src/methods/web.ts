import { InvalidDidError } from '../did-error.js'
import { Did, checkDidMsid } from '../did.js'

export const DID_WEB_PREFIX = `did:web:`

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

  // Make sure every char is valid
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
