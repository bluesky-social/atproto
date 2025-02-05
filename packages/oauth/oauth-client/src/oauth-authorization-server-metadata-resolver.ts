import {
  OAuthAuthorizationServerMetadata,
  oauthAuthorizationServerMetadataValidator,
  oauthIssuerIdentifierSchema,
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

export type { GetCachedOptions, OAuthAuthorizationServerMetadata }

export type AuthorizationServerMetadataCache = SimpleStore<
  string,
  OAuthAuthorizationServerMetadata
>

export type OAuthAuthorizationServerMetadataResolverConfig = {
  allowHttpIssuer?: boolean
}

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8414}
 */
export class OAuthAuthorizationServerMetadataResolver extends CachedGetter<
  string,
  OAuthAuthorizationServerMetadata
> {
  private readonly fetch: Fetch<unknown>
  private readonly allowHttpIssuer: boolean

  constructor(
    cache: AuthorizationServerMetadataCache,
    fetch?: Fetch,
    config?: OAuthAuthorizationServerMetadataResolverConfig,
  ) {
    super(async (issuer, options) => this.fetchMetadata(issuer, options), cache)

    this.fetch = bindFetch(fetch)
    this.allowHttpIssuer = config?.allowHttpIssuer === true
  }

  async get(
    input: string,
    options?: GetCachedOptions,
  ): Promise<OAuthAuthorizationServerMetadata> {
    const issuer = oauthIssuerIdentifierSchema.parse(input)
    if (!this.allowHttpIssuer && issuer.startsWith('http:')) {
      throw new TypeError(
        'Unsecure issuer URL protocol only allowed in development and test environments',
      )
    }
    return super.get(issuer, options)
  }

  private async fetchMetadata(
    issuer: string,
    options?: GetCachedOptions,
  ): Promise<OAuthAuthorizationServerMetadata> {
    const url = new URL(`/.well-known/oauth-authorization-server`, issuer)
    const request = new Request(url, {
      headers: { accept: 'application/json' },
      cache: options?.noCache ? 'no-cache' : undefined,
      signal: options?.signal,
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
