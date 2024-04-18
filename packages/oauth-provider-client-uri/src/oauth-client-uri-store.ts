import { CachedGetter, GenericStore, MemoryStore } from '@atproto-labs/caching'
import {
  Fetch,
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { Jwks, jwksSchema } from '@atproto-labs/jwk'
import {
  Awaitable,
  ClientData,
  ClientStore,
  InvalidClientMetadataError,
  InvalidRedirectUriError,
  OAuthClientId,
  OAuthClientMetadata,
  oauthClientMetadataSchema,
  parseRedirectUri,
} from '@atproto-labs/oauth-provider'
import { compose } from '@atproto-labs/transformer'

import { buildWellknownUrl, isInternetHost, isLoopbackHost } from './util.js'

export type LoopbackMetadataGetter = (
  url: URL,
) => Awaitable<Partial<OAuthClientMetadata>>
export type ClientMetadataValidator = (
  clientId: OAuthClientId,
  clientUrl: URL,
  metadata: OAuthClientMetadata,
) => Awaitable<void>

export type OAuthClientUriStoreConfig = {
  /**
   * In prod, it can be useful to enable SSRF & other kinds of protections.
   * This can be done by providing a custom fetch function that enforces
   * these protections. If you want to disable all protections, you can
   * provide `globalThis.fetch` as fetch function.
   */
  fetch: Fetch

  /**
   * In order to speed up the client fetching process, you can provide a cache
   * to store HTTP responses.
   */
  cache?: GenericStore<string>

  /**
   * In order to enable loopback clients, you can provide a function that
   * returns the client metadata for a given loopback URL. This is useful for
   * development and testing purposes. This function is not called for internet
   * clients.
   */
  loopbackMetadata?: null | false | LoopbackMetadataGetter

  /**
   * A custom function to validate the client metadata. This is useful for
   * enforcing custom rules on the client metadata. This function is called for
   * both loopback and internet clients.
   */
  validateMetadata?: null | false | ClientMetadataValidator
}

/**
 * This class is responsible for fetching client data based on it's ID. Since
 * clients are not pre-registered, we need to fetch their data from the network.
 */
export class OAuthClientUriStore implements ClientStore {
  #jsonFetch: CachedGetter<string>

  protected readonly loopbackMetadata?: LoopbackMetadataGetter
  protected readonly validateMetadataCustom?: ClientMetadataValidator

  constructor({
    fetch,
    cache = new MemoryStore({ maxSize: 50 * 1024 * 1024 }),
    loopbackMetadata,
    validateMetadata,
  }: OAuthClientUriStoreConfig) {
    this.loopbackMetadata = loopbackMetadata || undefined
    this.validateMetadataCustom = validateMetadata || undefined

    const jsonFetch = compose(
      fetch,
      fetchOkProcessor(),
      fetchJsonProcessor('application/json', false),
      (r: { json: unknown }) => r.json,
    )

    this.#jsonFetch = new CachedGetter<string>(async (url, options) => {
      const headers = new Headers([['accept', 'application/json']])
      if (options?.noCache) headers.set('cache-control', 'no-cache')
      const request = new Request(url, {
        headers,
        signal: options?.signal,
        redirect: 'error',
      })
      return jsonFetch(request).catch(fetchFailureHandler)
    }, cache)
  }

  public async findClient(clientId: OAuthClientId): Promise<ClientData> {
    const clientUrl = await this.buildClientUrl(clientId)

    if (isLoopbackHost(clientUrl.hostname)) {
      // It is not possible to fetch the client metadata for loopback URLs
      // because they are not accessible from the outside. We support this as a
      // special case by generating a client metadata object ourselves.
      return this.loopbackClient(clientId, clientUrl)
    } else if (isInternetHost(clientUrl.hostname)) {
      return this.internetClient(clientId, clientUrl)
    } else {
      throw new InvalidClientMetadataError(
        'Client ID hostname must be a valid domain',
      )
    }
  }

  protected async buildClientUrl(clientId: OAuthClientId): Promise<URL> {
    const url = (() => {
      try {
        return new URL(clientId)
      } catch (err) {
        throw new InvalidClientMetadataError('ClientID must be a URI', err)
      }
    })()

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new InvalidClientMetadataError(
        `ClientID must be an http or https URI`,
      )
    }

    if (url.href !== clientId) {
      throw new InvalidClientMetadataError(`ClientID must be a normalized URI`)
    }

    if (url.username || url.password) {
      throw new TypeError('ClientID URI must not contain credentials')
    }

    if (url.search || url.hash) {
      throw new TypeError('ClientID URI must not contain a query or fragment')
    }

    if (url.pathname.includes('//')) {
      throw new InvalidClientMetadataError(
        `ClientID URI must not contain any double slashes in its path`,
      )
    }

    return url
  }

  protected async loopbackClient(
    clientId: OAuthClientId,
    clientUrl: URL,
  ): Promise<ClientData> {
    if (!this.loopbackMetadata) {
      throw new InvalidClientMetadataError('Loopback clients are not allowed')
    }

    if (clientUrl.protocol !== 'http:') {
      throw new InvalidClientMetadataError(
        'Loopback ClientID URI must use the "http:" protocol',
      )
    }

    if (clientUrl.hostname !== 'localhost') {
      throw new InvalidClientMetadataError(
        'Loopback ClientID URI must use the "localhost" hostname',
      )
    }

    if (clientUrl.port) {
      throw new InvalidClientMetadataError(
        'Loopback ClientID URI must not use a custom port number',
      )
    }

    const metadata = oauthClientMetadataSchema.parse(
      await this.loopbackMetadata(clientUrl),
    )

    await this.validateMetadata(clientId, clientUrl, metadata)

    return { metadata, jwks: undefined }
  }

  protected async internetClient(
    clientId: OAuthClientId,
    clientUrl: URL,
  ): Promise<ClientData> {
    const metadataEndpoint = await this.getMetadataEndpoint(clientId, clientUrl)
    const metadata = await this.fetchMetadata(metadataEndpoint)
    await this.validateMetadata(clientId, clientUrl, metadata)

    return {
      metadata,
      jwks: metadata.jwks_uri
        ? await this.fetchJwks(new URL(metadata.jwks_uri))
        : undefined,
    }
  }

  protected async getMetadataEndpoint(
    clientId: OAuthClientId,
    clientUrl: URL,
  ): Promise<URL> {
    return buildWellknownUrl(clientUrl, `oauth-client-metadata`)
  }

  protected async fetchMetadata(
    metadataEndpoint: URL,
  ): Promise<OAuthClientMetadata> {
    const json = await this.#jsonFetch.get(metadataEndpoint.href)
    return oauthClientMetadataSchema.parse(json)
  }

  protected async fetchJwks(jwksUri: URL): Promise<Jwks> {
    const json = this.#jsonFetch.get(jwksUri.href)
    return jwksSchema.parse(json)
  }

  /**
   * Here we check that the metadata returned by the store is compatible with
   * the Atproto OAuth spec. OAuth compliance & validity will be enforced by the
   * ClientManager class in the oauth-provider package.
   */
  protected async validateMetadata(
    clientId: OAuthClientId,
    clientUrl: URL,
    metadata: OAuthClientMetadata,
  ): Promise<void> {
    await this.validateMetadataClientId(clientId, clientUrl, metadata)
    await this.validateMetadataClientUri(clientId, clientUrl, metadata)
    await this.validateMetadataRedirectUris(clientId, clientUrl, metadata)
    await this.validateMetadataCustom?.(clientId, clientUrl, metadata)
  }

  protected async validateMetadataClientId(
    clientId: OAuthClientId,
    clientUrl: URL,
    metadata: OAuthClientMetadata,
  ): Promise<void> {
    if (metadata.client_id && metadata.client_id !== clientId) {
      throw new InvalidClientMetadataError('client_id must match the client ID')
    }
  }

  protected async validateMetadataClientUri(
    clientId: OAuthClientId,
    clientUrl: URL,
    metadata: OAuthClientMetadata,
  ): Promise<void> {
    if (metadata.client_uri && metadata.client_uri !== clientUrl.href) {
      throw new InvalidClientMetadataError(
        'client_uri must match the client URI',
      )
    }
  }

  protected async validateMetadataRedirectUris(
    clientId: OAuthClientId,
    clientUrl: URL,
    metadata: OAuthClientMetadata,
  ): Promise<void> {
    for (const redirectUri of metadata.redirect_uris) {
      const uri = parseRedirectUri(redirectUri)

      switch (true) {
        case uri.hostname === 'localhost':
          // https://datatracker.ietf.org/doc/html/rfc8252#section-8.3
          //
          // > While redirect URIs using localhost (i.e.,
          // > "http://localhost:{port}/{path}") function similarly to loopback
          // > IP redirects described in Section 7.3, the use of localhost is
          // > NOT RECOMMENDED. Specifying a redirect URI with the loopback IP
          // > literal rather than localhost avoids inadvertently listening on
          // > network interfaces other than the loopback interface. It is also
          // > less susceptible to client-side firewalls and misconfigured host
          // > name resolution on the user's device.
          throw new InvalidRedirectUriError(
            `Loopback redirect URI ${uri} is not allowed (use explicit IPs instead)`,
          )

        // Loopback redirects
        case uri.hostname === '127.0.0.1':
        case uri.hostname === '[::1]':
          // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
          //
          // > Native Clients MUST only register redirect_uris using custom URI
          // > schemes or loopback URLs using the http scheme; loopback URLs use
          // > localhost or the IP loopback literals 127.0.0.1 or [::1] as the
          // > hostname.
          if (metadata.application_type !== 'native') {
            throw new InvalidRedirectUriError(
              `Loopback redirect URIs are not allowed for non-native clients`,
            )
          }
          if (uri.protocol !== 'http:') {
            throw new InvalidRedirectUriError(
              `Loopback redirect URIs must use the "http:" protocol`,
            )
          }
          continue

        case uri.protocol === 'http:':
        case uri.protocol === 'https:':
          // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
          //
          // > Native Clients MUST only register redirect_uris using custom URI
          // > schemes or loopback URLs using the http scheme; loopback URLs use
          // > localhost or the IP loopback literals 127.0.0.1 or [::1] as the
          // > hostname.
          //
          // "http:" case is already handled by the "Loopback redirects" case
          // before.
          //
          if (metadata.application_type === 'native') {
            throw new InvalidRedirectUriError(
              `Native clients must use loopback redirect URIs or custom URI schemes (got ${uri})`,
            )
          }
          continue

        default:
          continue
      }
    }
  }
}
