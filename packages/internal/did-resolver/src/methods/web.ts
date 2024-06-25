import {
  bindFetch,
  Fetch,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import { Did, didDocumentValidator, didWebToUrl } from '@atproto/did'

import { DidMethod, ResolveOptions } from '../did-method.js'

const fetchSuccessHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor(/^application\/(did\+ld\+)?json$/),
  fetchJsonZodProcessor(didDocumentValidator),
)

export type DidWebMethodOptions = {
  fetch?: Fetch
}

export class DidWebMethod implements DidMethod<'web'> {
  protected readonly fetch: Fetch<unknown>

  constructor({ fetch = globalThis.fetch }: DidWebMethodOptions = {}) {
    this.fetch = bindFetch(fetch)
  }

  async resolve(did: Did<'web'>, options?: ResolveOptions) {
    const didDocumentUrl = buildDidWebDocumentUrl(did)

    return this.fetch(didDocumentUrl, {
      redirect: 'error',
      headers: { accept: 'application/did+ld+json,application/json' },
      signal: options?.signal,
    }).then(fetchSuccessHandler)
  }
}

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8615}
 * @see {@link https://w3c-ccg.github.io/did-method-web/#create-register}
 */
export function buildDidWebDocumentUrl(did: Did<'web'>) {
  const url = didWebToUrl(did) // Will throw if the DID is invalid

  // Note: DID cannot end with an `:`, so they cannot end with a `/`. This is
  // true unless when there is no path at all, in which case the URL constructor
  // will set the pathname to `/`.

  // https://w3c-ccg.github.io/did-method-web/#read-resolve
  if (url.pathname === '/') {
    return new URL(`/.well-known/did.json`, url)
  } else {
    return new URL(`${url.pathname}/did.json`, url)
  }
}
