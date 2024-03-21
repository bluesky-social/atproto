import {
  Fetch,
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto/fetch'
import { compose } from '@atproto/transformer'
import { z } from 'zod'

import { didDocumentValidator } from '../did-document.js'
import { InvalidDidError } from '../did-error.js'
import { DidMethod, ResolveOptions } from '../did-method.js'
import { Did, checkDidMsid } from '../did.js'
import { asRefinement, wellKnownUrl } from '../util.js'

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

export function isDidWeb(input: string): input is Did<'web'> {
  try {
    didWebToUrl(input)
    return true
  } catch {
    return false
  }
}

export const didWebSchema = z
  .string()
  .superRefine(asRefinement<string, Did<'web'>>(didWebToUrl))

export function urlToDidWeb(url: URL): Did<'web'> {
  const path =
    url.pathname === '/'
      ? ''
      : url.pathname.slice(1).split('/').map(encodeURIComponent).join(':')

  return `did:web:${encodeURIComponent(url.host)}${path ? `:${path}` : ''}`
}

export function didWebDocumentUrl(did: Did<'web'>): URL {
  const url = didWebToUrl(did)
  return wellKnownUrl(url, 'did.json')
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
    const url = didWebDocumentUrl(did)

    const request = new Request(url, {
      redirect: 'error',
      headers: { accept: 'application/did+ld+json,application/json' },
      signal: options?.signal,
    })

    return this.fetch
      .call(globalThis, request)
      .then(didWebDocumentTransformer, fetchFailureHandler)
  }
}
