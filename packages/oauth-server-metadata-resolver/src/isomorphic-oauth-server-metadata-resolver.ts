import { CachedGetter, GenericStore } from '@atproto/caching'
import { Fetch, FetchError } from '@atproto/fetch'
import {
  OAuthServerMetadata,
  oauthServerMetadataValidator,
} from '@atproto/oauth-server-metadata'
import {
  OAuthServerMetadataResolver,
  ResolveOptions,
} from './oauth-server-metadata-resolver.js'

export type OAuthServerMetadataCache = GenericStore<string, OAuthServerMetadata>

export type IsomorphicOAuthServerMetadataResolverOptions = {
  fetch?: Fetch
  cache?: OAuthServerMetadataCache
}

export class IsomorphicOAuthServerMetadataResolver
  implements OAuthServerMetadataResolver
{
  readonly #fetch: Fetch
  readonly #getter: CachedGetter<string, OAuthServerMetadata>

  constructor({
    fetch = globalThis.fetch,
    cache,
  }: IsomorphicOAuthServerMetadataResolverOptions = {}) {
    this.#fetch = fetch
    this.#getter = new CachedGetter<string, OAuthServerMetadata>(
      async (origin, options) =>
        this.fetchServerMetadata(origin, 'oauth-authorization-server', options),
      cache,
    )
  }

  async resolve(origin: string): Promise<OAuthServerMetadata> {
    return this.#getter.get(origin)
  }

  async fetchServerMetadata(
    origin: string,
    suffix: 'openid-configuration' | 'oauth-authorization-server',
    options?: ResolveOptions,
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
      `/.well-known/${suffix}`,
      originUrl,
    )

    const headers = new Headers([['accept', 'application/json']])
    if (options?.noCache) headers.set('cache-control', 'no-cache')

    const request = new Request(oauthServerMetadataEndpoint, {
      signal: options?.signal,
      headers,
      // This is a particularity of the Atproto OAuth implementation. PDS's will
      // use a redirect to their AS's metadata endpoint. This might not be spec
      // compliant but we *do* check that the issuer is valid w.r.t the origin
      // of the last redirect url (see below).
      redirect: 'follow',
    })

    const response = await this.#fetch.call(globalThis, request)

    if (!response.ok) {
      // Fallback to openid-configuration endpoint
      if (suffix !== 'openid-configuration') {
        return this.fetchServerMetadata(origin, 'openid-configuration', options)
      }

      throw new FetchError(
        response.status,
        `Unable to fetch OAuth server metadata for "${origin}"`,
        { request, response },
      )
    }

    const metadata = oauthServerMetadataValidator.parse(await response.json())

    // Validate the issuer (MIX-UP attacks)
    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics#name-mix-up-attacks
    const issuerUrl = new URL(metadata.issuer)
    if (issuerUrl.pathname !== '/') {
      throw new Error(`Invalid issuer ${metadata.issuer}`)
    }
    const responseUrl = new URL(
      response.redirected ? response.url : request.url,
    )
    if (issuerUrl.origin !== responseUrl.origin) {
      throw new FetchError(502, `Invalid issuer ${metadata.issuer}`, {
        request,
        response,
      })
    }
    if (responseUrl.pathname !== `/.well-known/${suffix}`) {
      throw new FetchError(502, `Invalid metadata endpoint ${response.url}`, {
        request,
        response,
      })
    }

    return metadata
  }
}
