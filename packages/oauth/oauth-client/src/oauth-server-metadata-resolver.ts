import { Fetch, FetchError, FetchResponseError } from '@atproto-labs/fetch'
import {
  CachedGetter,
  GetCachedOptions,
  SimpleStore,
} from '@atproto-labs/simple-store'
import {
  OAuthServerMetadata,
  oauthServerMetadataValidator,
} from '@atproto/oauth-types'

export type MetadataResolveOptions = GetCachedOptions

export type MetadataCache = SimpleStore<string, OAuthServerMetadata>

export class OAuthServerMetadataResolver {
  private readonly getter: CachedGetter<string, OAuthServerMetadata>

  constructor(
    cache: MetadataCache,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {
    this.getter = new CachedGetter<string, OAuthServerMetadata>(
      async (origin, options) => this.fetchServerMetadata(origin, options),
      cache,
    )
  }

  async resolve(
    origin: string,
    options?: MetadataResolveOptions,
  ): Promise<OAuthServerMetadata> {
    const metadata = await this.getter.get(origin, options)
    return metadata
  }

  private async fetchServerMetadata(
    origin: string,
    options?: MetadataResolveOptions,
  ): Promise<OAuthServerMetadata> {
    const originUrl = new URL(origin)
    if (originUrl.origin !== origin) {
      throw new TypeError(
        `OAuth server origin must not contain a path, query, or fragment.`,
      )
    }

    if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
      throw new TypeError(`Issuer origin must use "https" or "http"`)
    }

    const oauthServerMetadataEndpoint = new URL(
      `/.well-known/oauth-authorization-server`,
      originUrl,
    )

    const headers = new Headers([['accept', 'application/json']])
    if (options?.noCache) headers.set('cache-control', 'no-cache')

    const request = new Request(oauthServerMetadataEndpoint, {
      signal: options?.signal,
      headers,
      // This is a particularity of the Atproto OAuth implementation. PDS's will
      // use a redirect to their AS's metadata endpoint. This might not be
      // compliant with OAuth spec & recommendations but we *do* check that the
      // issuer is valid w.r.t the origin of the last redirect url (see below).
      redirect: 'follow',
    })

    const response = await this.fetch.call(null, request)

    if (!response.ok) {
      throw await FetchResponseError.from(
        response,
        `Unable to fetch OAuth server metadata for "${origin}"`,
        undefined,
        { request },
      )
    }

    const metadata = oauthServerMetadataValidator.parse(await response.json())

    // Validate the issuer (MIX-UP attacks)
    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics#name-mix-up-attacks
    const issuerUrl = new URL(metadata.issuer)
    if (issuerUrl.pathname !== '/') {
      throw new Error(`Invalid issuer ${metadata.issuer}`)
    }
    // https://datatracker.ietf.org/doc/html/rfc8414#section-2
    if (issuerUrl.search || issuerUrl.hash) {
      throw new Error(`Invalid issuer ${metadata.issuer}`)
    }
    const responseUrl = new URL(response.url)
    if (issuerUrl.origin !== responseUrl.origin) {
      throw new FetchError(502, `Invalid issuer ${metadata.issuer}`, {
        request,
        response,
      })
    }

    if (responseUrl.pathname !== oauthServerMetadataEndpoint.pathname) {
      throw new FetchError(502, `Invalid metadata endpoint "${responseUrl}"`, {
        request,
        response,
      })
    }

    return metadata
  }
}
