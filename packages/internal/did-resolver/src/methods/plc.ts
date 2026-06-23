import { Did, assertDidPlc, didDocumentValidator } from '@atproto/did'
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

export type DidPlcMethodOptions = {
  /**
   * @default globalThis.fetch
   */
  fetch?: Fetch

  /**
   * @default 'https://plc.directory/'
   */
  plcDirectoryUrl?: string | URL
}

export class DidPlcMethod implements DidMethod<'plc'> {
  protected readonly fetch: Fetch<unknown>

  public readonly plcDirectoryUrl: URL

  constructor(options?: DidPlcMethodOptions) {
    this.plcDirectoryUrl = new URL(
      options?.plcDirectoryUrl || 'https://plc.directory/',
    )
    this.fetch = bindFetch(options?.fetch)
  }

  async resolve(did: Did<'plc'>, options?: ResolveDidOptions) {
    // Although the did should start with `did:plc:` (thanks to typings), we
    // should still check if the msid is valid.
    assertDidPlc(did)

    // Should never throw
    const url = new URL(`/${encodeURIComponent(did)}`, this.plcDirectoryUrl)

    return this.fetch(url, {
      redirect: 'error',
      headers: { accept: 'application/did+ld+json,application/json' },
      signal: options?.signal,
    }).then(fetchSuccessHandler)
  }
}
