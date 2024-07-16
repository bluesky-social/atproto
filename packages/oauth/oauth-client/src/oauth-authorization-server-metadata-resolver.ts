import {
  bindFetch,
  cancelBody,
  Fetch,
  FetchResponseError,
} from '@atproto-labs/fetch'
import {
  CachedGetter,
  GetCachedOptions,
  SimpleStore,
} from '@atproto-labs/simple-store'
import {
  OAuthAuthorizationServerMetadata,
  oauthAuthorizationServerMetadataValidator,
  oauthIssuerIdentifierSchema,
} from '@atproto/oauth-types'
import { contentMime } from './util'

export type { GetCachedOptions, OAuthAuthorizationServerMetadata }

export type AuthorizationServerMetadataCache = SimpleStore<
  string,
  OAuthAuthorizationServerMetadata
>

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8414}
 */
export class OAuthAuthorizationServerMetadataResolver extends CachedGetter<
  string,
  OAuthAuthorizationServerMetadata
> {
  private readonly fetch: Fetch<unknown>

  constructor(cache: AuthorizationServerMetadataCache, fetch?: Fetch) {
    super(async (issuer, options) => this.fetchMetadata(issuer, options), cache)

    this.fetch = bindFetch(fetch)
  }

  async get(
    issuer: string,
    options?: GetCachedOptions,
  ): Promise<OAuthAuthorizationServerMetadata> {
    return super.get(oauthIssuerIdentifierSchema.parse(issuer), options)
  }

  private async fetchMetadata(
    issuer: string,
    options?: GetCachedOptions,
  ): Promise<OAuthAuthorizationServerMetadata> {
    const headers = new Headers([['accept', 'application/json']])
    if (options?.noCache) headers.set('cache-control', 'no-cache')

    const url = new URL(`/.well-known/oauth-authorization-server`, issuer)
    const request = new Request(url, {
      signal: options?.signal,
      headers,
      redirect: 'manual', // response must be 200 OK
    })

    const response = await this.fetch(request)

    // https://datatracker.ietf.org/doc/html/rfc8414#section-3.2
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

    const metadata = oauthAuthorizationServerMetadataValidator.parse(
      await response.json(),
    )

    // Validate the issuer (MIX-UP attacks)
    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics#name-mix-up-attacks
    // https://datatracker.ietf.org/doc/html/rfc8414#section-2
    if (metadata.issuer !== issuer) {
      throw new TypeError(`Invalid issuer ${metadata.issuer}`)
    }

    // ATPROTO requires client_id_metadata_document
    // http://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html
    if (metadata.client_id_metadata_document_supported !== true) {
      throw new TypeError(
        `Authorization server "${issuer}" does not support client_id_metadata_document`,
      )
    }

    return metadata
  }
}
