import { Did, DidError, didDocumentValidator, didWebToUrl } from '@atproto/did'
import {
  Fetch,
  bindFetch,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import { DidMethod, ResolveDidOptions } from '../did-method.js'

const fetchSuccessHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor(/^application\/(did\+ld\+)?json$/),
  fetchJsonZodProcessor(didDocumentValidator),
)

export type DidWebMethodOptions = {
  fetch?: Fetch
  /** @default true */
  allowHttp?: boolean
}

export class DidWebMethod implements DidMethod<'web'> {
  protected readonly fetch: Fetch<unknown>
  protected readonly allowHttp: boolean

  constructor({
    fetch = globalThis.fetch,
    allowHttp = true,
  }: DidWebMethodOptions = {}) {
    this.fetch = bindFetch(fetch)
    this.allowHttp = allowHttp
  }

  async resolve(did: Did<'web'>, options?: ResolveDidOptions) {
    const didDocumentUrl = buildDidWebDocumentUrl(did)

    if (!this.allowHttp && didDocumentUrl.protocol === 'http:') {
      throw new DidError(
        did,
        'Resolution of "http" did:web is not allowed',
        'did-web-http-not-allowed',
      )
    }

    // Note we do not explicitly check for "localhost" here. Instead, we rely on
    // the injected 'fetch' function to handle the URL. If the URL is
    // "localhost", or resolves to a private IP address, the fetch function is
    // responsible for handling it.

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
