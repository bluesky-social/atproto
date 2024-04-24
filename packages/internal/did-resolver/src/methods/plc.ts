import {
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import { Did, checkDidPlc, didDocumentValidator } from '@atproto/did'

import { DidMethod, ResolveOptions } from '../did-method.js'

const fetchSuccessHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor(/^application\/(did\+ld\+)?json$/),
  fetchJsonZodProcessor(didDocumentValidator),
)

export type DidPlcMethodOptions = {
  /**
   * @default globalThis.fetch
   */
  fetch?: typeof globalThis.fetch

  /**
   * @default 'https://plc.directory/'
   */
  plcDirectoryUrl?: string | URL
}

export class DidPlcMethod implements DidMethod<'plc'> {
  protected readonly fetch: typeof globalThis.fetch

  public readonly plcDirectoryUrl: URL

  constructor({
    plcDirectoryUrl = 'https://plc.directory/',
    fetch = globalThis.fetch,
  }: DidPlcMethodOptions = {}) {
    this.plcDirectoryUrl = new URL(plcDirectoryUrl)
    this.fetch = fetch
  }

  async resolve(did: Did<'plc'>, options?: ResolveOptions) {
    checkDidPlc(did)

    const url = new URL(`/${did}`, this.plcDirectoryUrl)

    return this.fetch
      .call(null, url, {
        redirect: 'error',
        headers: { accept: 'application/did+ld+json,application/json' },
        signal: options?.signal,
      })
      .then(fetchSuccessHandler, fetchFailureHandler)
  }
}
