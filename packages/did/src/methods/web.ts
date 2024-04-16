import {
  Fetch,
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto/fetch'
import { compose } from '@atproto/transformer'

import { didDocumentValidator } from '../did-document.js'
import { InvalidDidError } from '../did-error.js'
import { DidMethod, ResolveOptions } from '../did-method.js'
import { Did, checkDidMsid } from '../did.js'
import { wellKnownUrl } from '../util.js'

export const DID_WEB_PREFIX = `did:web:`

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
    throw new InvalidDidError(
      did,
      'Invalid Web DID',
      undefined,
      undefined,
      cause,
    )
  }
}

export function urlToDidWeb(url: URL): Did<'web'> {
  const path =
    url.pathname === '/'
      ? ''
      : url.pathname.slice(1).split('/').map(encodeURIComponent).join(':')

  return `did:web:${encodeURIComponent(url.host)}${path ? `:${path}` : ''}`
}

const didWebDocumentTransformer = compose(
  fetchOkProcessor(),
  fetchJsonProcessor(/^application\/(did\+ld\+)?json$/),
  fetchJsonZodProcessor(didDocumentValidator),
)

export type DidWebMethodOptions = {
  fetch?: Fetch
}

export class DidWebMethod implements DidMethod<'web'> {
  protected readonly fetch: Fetch

  constructor({ fetch = globalThis.fetch }: DidWebMethodOptions = {}) {
    this.fetch = fetch
  }

  async resolve(did: Did<'web'>, options?: ResolveOptions) {
    const url = didWebToUrl(did) // Will throw if the DID is invalid
    const didDocumentUrl = wellKnownUrl(url, 'did.json')

    const request = new Request(didDocumentUrl, {
      redirect: 'error',
      headers: { accept: 'application/did+ld+json,application/json' },
      signal: options?.signal,
    })

    const { fetch } = this
    return fetch(request).then(didWebDocumentTransformer, fetchFailureHandler)
  }
}
