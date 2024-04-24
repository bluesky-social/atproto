import {
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import { Did, didDocumentValidator, didWebToUrl } from '@atproto/did'

import { DidMethod, ResolveOptions } from '../did-method.js'
import { wellKnownUrl } from '../util.js'

const fetchSuccessHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor(/^application\/(did\+ld\+)?json$/),
  fetchJsonZodProcessor(didDocumentValidator),
)

export type DidWebMethodOptions = {
  fetch?: typeof globalThis.fetch
}

export class DidWebMethod implements DidMethod<'web'> {
  protected readonly fetch: typeof globalThis.fetch

  constructor({ fetch = globalThis.fetch }: DidWebMethodOptions = {}) {
    this.fetch = fetch
  }

  async resolve(did: Did<'web'>, options?: ResolveOptions) {
    const url = didWebToUrl(did) // Will throw if the DID is invalid
    const didDocumentUrl = wellKnownUrl(url, 'did.json')

    return this.fetch
      .call(null, didDocumentUrl, {
        redirect: 'error',
        headers: { accept: 'application/did+ld+json,application/json' },
        signal: options?.signal,
      })
      .then(fetchSuccessHandler, fetchFailureHandler)
  }
}
