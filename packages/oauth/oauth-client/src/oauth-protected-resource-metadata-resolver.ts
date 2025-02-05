import {
  OAuthProtectedResourceMetadata,
  oauthProtectedResourceMetadataSchema,
} from '@atproto/oauth-types'
import {
  Fetch,
  FetchResponseError,
  bindFetch,
  cancelBody,
} from '@atproto-labs/fetch'
import {
  CachedGetter,
  GetCachedOptions,
  SimpleStore,
} from '@atproto-labs/simple-store'
import { contentMime } from './util.js'

export type { GetCachedOptions, OAuthProtectedResourceMetadata }

export type ProtectedResourceMetadataCache = SimpleStore<
  string,
  OAuthProtectedResourceMetadata
>

export type OAuthProtectedResourceMetadataResolverConfig = {
  allowHttpResource?: boolean
}

/**
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05}
 */
export class OAuthProtectedResourceMetadataResolver extends CachedGetter<
  string,
  OAuthProtectedResourceMetadata
> {
  private readonly fetch: Fetch<unknown>
  private readonly allowHttpResource: boolean

  constructor(
    cache: ProtectedResourceMetadataCache,
    fetch: Fetch = globalThis.fetch,
    config?: OAuthProtectedResourceMetadataResolverConfig,
  ) {
    super(async (origin, options) => this.fetchMetadata(origin, options), cache)

    this.fetch = bindFetch(fetch)
    this.allowHttpResource = config?.allowHttpResource === true
  }

  async get(
    resource: string | URL,
    options?: GetCachedOptions,
  ): Promise<OAuthProtectedResourceMetadata> {
    const { protocol, origin } = new URL(resource)

    if (protocol !== 'https:' && protocol !== 'http:') {
      throw new TypeError(
        `Invalid protected resource metadata URL protocol: ${protocol}`,
      )
    }

    if (protocol === 'http:' && !this.allowHttpResource) {
      throw new TypeError(
        `Unsecure resource metadata URL (${protocol}) only allowed in development and test environments`,
      )
    }

    return super.get(origin, options)
  }

  private async fetchMetadata(
    origin: string,
    options?: GetCachedOptions,
  ): Promise<OAuthProtectedResourceMetadata> {
    const url = new URL(`/.well-known/oauth-protected-resource`, origin)
    const request = new Request(url, {
      signal: options?.signal,
      headers: { accept: 'application/json' },
      cache: options?.noCache ? 'no-cache' : undefined,
      redirect: 'manual', // response must be 200 OK
    })

    const response = await this.fetch(request)

    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05#section-3.2
    if (response.status !== 200) {
      await cancelBody(response, 'log')
      throw await FetchResponseError.from(
        response,
        `Unexpected status code ${response.status} for "${url}"`,
        undefined,
        { cause: request },
      )
    }

    if (contentMime(response.headers) !== 'application/json') {
      await cancelBody(response, 'log')
      throw await FetchResponseError.from(
        response,
        `Unexpected content type for "${url}"`,
        undefined,
        { cause: request },
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
