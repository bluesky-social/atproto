import {
  Fetch,
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchOkProcessor,
  fetchJsonZodProcessor,
} from '@atproto/fetch'
import { compose } from '@atproto/transformer'
import { z } from 'zod'

import { didDocumentValidator } from '../did-document.js'
import { InvalidDidError } from '../did-error.js'
import { DidMethod, ResolveOptions } from '../did-method.js'
import { Did, didSchema } from '../did.js'
import { wellKnownUrl } from '../util.js'

export const DID_WEB_PREFIX = `did:web:`

export function isDidWeb(did: string): did is Did<'web'> {
  if (!did.startsWith(DID_WEB_PREFIX)) return false
  try {
    didWebToUrl(did as any)
    return true
  } catch {
    return false
  }
}

export const didWebSchema = didSchema.refinement(isDidWeb, {
  code: z.ZodIssueCode.custom,
  message: 'Invalid Web DID',
})

export function urlToDidWeb(url: URL): Did<'web'> {
  const path =
    url.pathname === '/'
      ? ''
      : url.pathname.slice(1).split('/').map(encodeURIComponent).join(':')

  return `did:web:${encodeURIComponent(url.host)}${path ? `:${path}` : ''}`
}

export function didWebToUrl(did: Did<'web'>): URL {
  const suffix = did.slice(DID_WEB_PREFIX.length)
  if (!suffix || suffix.startsWith(':') || suffix.endsWith(':')) {
    throw new InvalidDidError(did, `Invalid Web DID`)
  }
  try {
    // suffix does not start with a ":" so parts[0] (=host) is not empty
    const parts = suffix.split(':').map(decodeURIComponent)
    return new URL(`https://${parts.join('/')}`)
  } catch (err) {
    throw new InvalidDidError(did, 'Invalid Web DID')
  }
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

export default () => new DidWebMethod()
