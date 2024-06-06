import {
  Fetch,
  FetchResponseError,
  cancelBody,
  fetchFailureHandler,
} from '@atproto-labs/fetch'
import {
  CachedGetter,
  GetCachedOptions,
  SimpleStore,
} from '@atproto-labs/simple-store'
import {
  OAuthProtectedResourceMetadata,
  oauthProtectedResourceMetadataSchema,
} from '@atproto/oauth-types'
import { contentMime } from './util'

export type { GetCachedOptions }
export type { OAuthProtectedResourceMetadata }

export type ProtectedResourceMetadataCache = SimpleStore<
  string,
  OAuthProtectedResourceMetadata
>

/**
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05}
 */
export class OAuthProtectedResourceMetadataResolver extends CachedGetter<
  string,
  OAuthProtectedResourceMetadata
> {
  constructor(
    cache: ProtectedResourceMetadataCache,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {
    super(async (origin, options) => this.fetchMetadata(origin, options), cache)
  }

  async get(
    resource: string | URL,
    options?: GetCachedOptions,
  ): Promise<OAuthProtectedResourceMetadata> {
    const { protocol, origin } = new URL(resource)
    if (protocol !== 'https:' && protocol !== 'http:') {
      throw new TypeError(`Invalid resource server ${protocol}`)
    }
    return super.get(origin, options)
  }

  private async fetchMetadata(
    origin: string,
    options?: GetCachedOptions,
  ): Promise<OAuthProtectedResourceMetadata> {
    const headers = new Headers([['accept', 'application/json']])
    if (options?.noCache) headers.set('cache-control', 'no-cache')

    const url = new URL(`/.well-known/oauth-protected-resource`, origin)
    const request = new Request(url, {
      signal: options?.signal,
      headers,
      redirect: 'error', // response must be 200 OK
    })

    const response = await this.fetch
      .call(null, request)
      .catch(fetchFailureHandler)

    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05#section-3.2
    if (response.status !== 200) {
      await cancelBody(response, 'log')
      throw await FetchResponseError.from(
        response,
        `Unexpected status code ${response.status} for "${url}"`,
        undefined,
        { request },
      )
    }

    if (contentMime(response.headers) !== 'application/json') {
      await cancelBody(response, 'log')
      throw await FetchResponseError.from(
        response,
        `Unexpected content type for "${url}"`,
        undefined,
        { request },
      )
    }

    const metadata = oauthProtectedResourceMetadataSchema.parse(
      await response.json(),
    )

    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05#section-3.3
    if (metadata.resource !== origin) {
      throw new TypeError(`Invalid issuer ${metadata.resource}`)
    }

    return metadata
  }
}
