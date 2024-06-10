import {
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
  isIp,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import {
  CachedGetter,
  GetCachedOptions,
  SimpleStore,
} from '@atproto-labs/simple-store'
import { Jwks, jwksSchema, Keyset } from '@atproto/jwk'
import {
  OAuthClientMetadata,
  oauthClientMetadataSchema,
} from '@atproto/oauth-types'

import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { InvalidRedirectUriError } from '../errors/invalid-redirect-uri-error.js'
import { OAuthError } from '../errors/oauth-error.js'
import { Awaitable } from '../lib/util/type.js'
import { ClientHooks } from './client-hooks.js'
import {
  ClientId,
  DiscoverableClientId,
  isDiscoverableClientId,
  isLoopbackClientId,
  LoopbackClientId,
} from './client-id.js'
import { ClientStore } from './client-store.js'
import {
  parseDiscoverableClientId,
  parseLoopbackClientId,
  parseRedirectUri,
} from './client-utils.js'
import { Client } from './client.js'

const fetchMetadataHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor('application/json', false),
  fetchJsonZodProcessor(oauthClientMetadataSchema),
)

const fetchJwksHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor('application/json', false),
  fetchJsonZodProcessor(jwksSchema),
)

export type LoopbackMetadataGetter = (
  this: void,
  url: URL,
) => Awaitable<Partial<OAuthClientMetadata>>

export class ClientManager {
  protected readonly jwks: CachedGetter<string, Jwks>
  protected readonly metadata: CachedGetter<string, OAuthClientMetadata>

  constructor(
    protected readonly keyset: Keyset,
    protected readonly hooks: ClientHooks,
    protected readonly store: ClientStore | null,
    protected readonly loopbackMetadata: LoopbackMetadataGetter | null = null,
    safeFetch: typeof globalThis.fetch,
    clientJwksCache: SimpleStore<string, Jwks>,
    clientMetadataCache: SimpleStore<string, OAuthClientMetadata>,
  ) {
    this.jwks = new CachedGetter(async (uri, options) => {
      const jwks = await safeFetch(buildJsonGetRequest(uri, options)).then(
        fetchJwksHandler,
        fetchFailureHandler,
      )

      return jwks
    }, clientJwksCache)

    this.metadata = new CachedGetter(async (uri, options) => {
      const metadata = await safeFetch(buildJsonGetRequest(uri, options)).then(
        fetchMetadataHandler,
        fetchFailureHandler,
      )

      // Validate within the getter to avoid caching invalid metadata
      return this.validateClientMetadata(uri, metadata)
    }, clientMetadataCache)
  }

  /**
   *
   * @see {@link https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2 OIDC Client Registration}
   */
  public async getClient(clientId: string) {
    try {
      const metadata = await this.getClientMetadata(clientId)

      const jwks = metadata.jwks_uri
        ? await this.jwks.get(metadata.jwks_uri)
        : undefined

      await this.hooks.onClientData?.(clientId, { metadata, jwks })

      return new Client(clientId, metadata, jwks)
    } catch (err) {
      if (err instanceof OAuthError) throw err
      if (err?.['code'] === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        throw new InvalidClientMetadataError('Self-signed certificate', err)
      }
      throw InvalidClientMetadataError.from(err)
    }
  }

  protected async getClientMetadata(
    clientId: ClientId,
  ): Promise<OAuthClientMetadata> {
    if (isLoopbackClientId(clientId)) {
      return this.getLoopbackClientMetadata(clientId)
    } else if (isDiscoverableClientId(clientId)) {
      return this.getDiscoverableClientMetadata(clientId)
    } else if (this.store) {
      return this.getStoredClientMetadata(clientId)
    }

    throw new InvalidClientMetadataError(`Invalid client ID "${clientId}"`)
  }

  protected async getLoopbackClientMetadata(
    clientId: LoopbackClientId,
  ): Promise<OAuthClientMetadata> {
    const { loopbackMetadata } = this
    if (!loopbackMetadata) {
      throw new InvalidClientMetadataError('Loopback clients are not allowed')
    }

    const metadataUrl = parseLoopbackClientId(clientId)
    const result = oauthClientMetadataSchema.safeParse(
      await loopbackMetadata(metadataUrl),
    )

    if (!result.success) {
      throw InvalidClientMetadataError.from(result.error)
    }

    return this.validateClientMetadata(metadataUrl.href, result.data)
  }

  protected async getDiscoverableClientMetadata(
    clientId: DiscoverableClientId,
  ): Promise<OAuthClientMetadata> {
    const metadataUrl = parseDiscoverableClientId(clientId)

    const metadata = await this.metadata.get(metadataUrl.href)

    // Note: we do *not* re-validate the metadata here, as the metadata is
    // validated within the getter. This is to avoid double validation.
    //
    // return this.validateClientMetadata(metadataUrl.href, metadata)
    return metadata
  }

  protected async getStoredClientMetadata(
    clientId: ClientId,
  ): Promise<OAuthClientMetadata> {
    if (this.store) {
      const metadata = await this.store.findClient(clientId)
      return this.validateClientMetadata(clientId, metadata)
    }

    throw new InvalidClientMetadataError(`Invalid client ID "${clientId}"`)
  }

  /**
   * This method will ensure that the client metadata is valid w.r.t. the OAuth
   * and OIDC specifications. It will also ensure that the metadata is
   * compatible with the implementation of this library, and ATPROTO's
   * requirements.
   */
  protected validateClientMetadata(
    clientId: ClientId,
    metadata: OAuthClientMetadata,
  ): OAuthClientMetadata {
    if (metadata.jwks && metadata.jwks_uri) {
      throw new InvalidClientMetadataError(
        'jwks_uri and jwks are mutually exclusive',
      )
    }

    const scopes = metadata.scope?.split(' ')
    if (
      metadata.grant_types.includes('refresh_token') !==
      (scopes?.includes('offline_access') ?? false)
    ) {
      throw new InvalidClientMetadataError(
        'Grant type "refresh_token" requires scope "offline_access"',
      )
    }

    for (const grantType of metadata.grant_types) {
      switch (grantType) {
        case 'authorization_code':
        case 'refresh_token':
        case 'implicit': // Required by OIDC (for id_token)
          continue
        case 'password':
          throw new InvalidClientMetadataError(
            `Grant type "${grantType}" is not allowed`,
          )
        default:
          throw new InvalidClientMetadataError(
            `Grant type "${grantType}" is not supported`,
          )
      }
    }

    if (metadata.client_id) {
      if (metadata.client_id !== clientId) {
        throw new InvalidClientMetadataError('client_id does not match')
      }
    } else if (isDiscoverableClientId(clientId)) {
      // https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html
      throw new InvalidClientMetadataError(
        `client_id is required for discoverable clients`,
      )
    }

    if (metadata.subject_type && metadata.subject_type !== 'public') {
      throw new InvalidClientMetadataError(
        'Only "public" subject_type is supported',
      )
    }

    if (
      metadata.userinfo_signed_response_alg &&
      !this.keyset.signAlgorithms.includes(
        metadata.userinfo_signed_response_alg,
      )
    ) {
      throw new InvalidClientMetadataError(
        `Unsupported "userinfo_signed_response_alg" ${metadata.userinfo_signed_response_alg}`,
      )
    }

    if (
      metadata.id_token_signed_response_alg &&
      !this.keyset.signAlgorithms.includes(
        metadata.id_token_signed_response_alg,
      )
    ) {
      throw new InvalidClientMetadataError(
        `Unsupported "id_token_signed_response_alg" ${metadata.id_token_signed_response_alg}`,
      )
    }

    if (metadata.userinfo_encrypted_response_alg) {
      // We only support signature for now.
      throw new InvalidClientMetadataError(
        'Encrypted userinfo response is not supported',
      )
    }

    for (const endpoint of ['token', 'introspection', 'revocation'] as const) {
      const method =
        metadata[`${endpoint}_endpoint_auth_method`] ||
        metadata[`token_endpoint_auth_method`]

      switch (method) {
        case 'none':
          break
        case 'private_key_jwt':
          if (metadata.jwks?.keys.length === 0) {
            throw new InvalidClientMetadataError(
              `private_key_jwt auth method requires at least one key in jwks`,
            )
          }
          if (!metadata.token_endpoint_auth_signing_alg) {
            throw new InvalidClientMetadataError(
              `Missing token_endpoint_auth_signing_alg client metadata`,
            )
          }
          break
        case 'self_signed_tls_client_auth':
        case 'tls_client_auth':
          // We choose to use the `client_assertion` method instead.
          throw new InvalidClientMetadataError(
            `${method} is not supported. Use private_key_jwt instead.`,
          )

        case 'client_secret_post':
        case 'client_secret_basic':
        case 'client_secret_jwt':
          // Not supported by the Atproto "lazy client registration" model.
          throw new InvalidClientMetadataError(`${method} is not allowed`)

        case undefined:
          throw new InvalidClientMetadataError(
            `Missing "${endpoint}_endpoint_auth_method" client metadata`,
          )
        default:
          throw new InvalidClientMetadataError(
            `Unsupported "${endpoint}_endpoint_auth_method" client metadata`,
          )
      }
    }

    if (metadata.authorization_encrypted_response_enc) {
      throw new InvalidClientMetadataError(
        'Encrypted authorization response is not supported',
      )
    }

    if (metadata.tls_client_certificate_bound_access_tokens) {
      throw new InvalidClientMetadataError(
        'Mutual-TLS bound access tokens are not supported',
      )
    }

    if (
      metadata.authorization_encrypted_response_enc &&
      !metadata.authorization_encrypted_response_alg
    ) {
      throw new InvalidClientMetadataError(
        'authorization_encrypted_response_enc requires authorization_encrypted_response_alg',
      )
    }

    // ATPROTO spec requires the use of DPoP (OAuth spec defaults to false)
    if (metadata.dpop_bound_access_tokens !== true) {
      throw new InvalidClientMetadataError(
        '"dpop_bound_access_tokens" must be true',
      )
    }

    for (const responseType of metadata.response_types) {
      const rt = responseType.split(' ')

      // ATPROTO spec requires the use of PKCE
      if (rt.includes('token')) {
        throw new InvalidClientMetadataError(
          '"token" response type is not compatible with PKCE (use "code" instead)',
        )
      }

      if (
        rt.includes('code') &&
        !metadata.grant_types.includes('authorization_code')
      ) {
        throw new InvalidClientMetadataError(
          `Response type "${responseType}" requires the "authorization_code" grant type`,
        )
      }

      if (rt.includes('id_token') && !scopes?.includes('openid')) {
        throw new InvalidClientMetadataError(
          'Response type "token" requires scope "openid"',
        )
      }

      // Asking for "code token" or "code id_token" is fine (as long as the
      // grant_types includes "authorization_code" and the scope includes
      // "openid"). Asking for "token" or "id_token" (without "code") requires
      // the "implicit" grant type.
      if (
        !rt.includes('code') &&
        (rt.includes('token') || rt.includes('id_token')) &&
        !metadata.grant_types.includes('implicit')
      ) {
        throw new InvalidClientMetadataError(
          `Response type "${responseType}" requires the "implicit" grant type`,
        )
      }
    }

    // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2

    // > Web Clients [as defined by "application_type"] using the OAuth
    // > Implicit Grant Type MUST only register URLs using the https scheme as
    // > redirect_uris; they MUST NOT use localhost as the hostname. Native
    // > Clients [as defined by "application_type"] MUST only register
    // > redirect_uris using custom URI schemes or loopback URLs using the
    // > http scheme; loopback URLs use localhost or the IP loopback literals
    // > 127.0.0.1 or [::1] as the hostname. Authorization Servers MAY place
    // > additional constraints on Native Clients. Authorization Servers MAY
    // > reject Redirection URI values using the http scheme, other than the
    // > loopback case for Native Clients. The Authorization Server MUST
    // > verify that all the registered redirect_uris conform to these
    // > constraints. This prevents sharing a Client ID across different types
    // > of Clients.
    for (const redirectUri of metadata.redirect_uris) {
      const url = parseRedirectUri(redirectUri)

      switch (true) {
        case url.hostname === 'localhost':
          // https://datatracker.ietf.org/doc/html/rfc8252#section-8.3
          //
          // > While redirect URIs using localhost (i.e.,
          // > "http://localhost:{port}/{path}") function similarly to
          // > loopback IP redirects described in Section 7.3, the use of
          // > localhost is NOT RECOMMENDED. Specifying a redirect URI with
          // > the loopback IP literal rather than localhost avoids
          // > inadvertently listening on network interfaces other than the
          // > loopback interface. It is also less susceptible to client-side
          // > firewalls and misconfigured host name resolution on the user's
          // > device.
          throw new InvalidRedirectUriError(
            `Loopback redirect URI ${url} is not allowed (use explicit IPs instead)`,
          )

        // Loopback Interface Redirection
        // https://datatracker.ietf.org/doc/html/rfc8252#section-7.3
        case url.hostname === '127.0.0.1':
        case url.hostname === '[::1]': {
          // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
          //
          // > Native Clients MUST only register redirect_uris using custom
          // > URI schemes or loopback URLs using the http scheme; loopback
          // > URLs use localhost or the IP loopback literals 127.0.0.1 or
          // > [::1] as the hostname.
          if (metadata.application_type !== 'native') {
            throw new InvalidRedirectUriError(
              'Loopback redirect URIs are only allowed for native apps',
            )
          }
          if (url.port) {
            throw new InvalidRedirectUriError(
              `Loopback redirect URI ${url} must not contain a port`,
            )
          }
          if (url.protocol !== 'http:') {
            throw new InvalidRedirectUriError(
              `Loopback redirect URI ${url} must use HTTP`,
            )
          }
          continue
        }

        case url.protocol === 'http:': {
          // ATPROTO spec forbids http redirects (except for loopback, covered before)
          throw new InvalidRedirectUriError(
            `Redirect URI ${url} must use HTTPS`,
          )
        }

        // Claimed "https" Scheme URI Redirection
        // https://datatracker.ietf.org/doc/html/rfc8252#section-7.2
        case url.protocol === 'https:': {
          // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
          //
          // > Native Clients MUST only register redirect_uris using custom
          // > URI schemes or loopback URLs using the http scheme; loopback
          // > URLs use localhost or the IP loopback literals 127.0.0.1 or
          // > [::1] as the hostname.
          //
          // "http:" case is already handled by the "Loopback redirects" case
          // before.
          //
          if (metadata.application_type === 'native') {
            throw new InvalidRedirectUriError(
              `Native clients must use loopback redirect URIs or custom URI schemes (got ${url})`,
            )
          }

          continue
        }

        // Private-Use URI Scheme (must contain at least one dot)
        // https://datatracker.ietf.org/doc/html/rfc8252#section-7.1
        // > When choosing a URI scheme to associate with the app, apps MUST
        // > use a URI scheme based on a domain name under their control,
        // > expressed in reverse order, as recommended by Section 3.8 of
        // > [RFC7595] for private-use URI schemes.
        case url.protocol.includes('.'): {
          if (metadata.application_type !== 'native') {
            throw new InvalidRedirectUriError(
              `Private-Use URI Scheme redirect URI are only allowed for native apps`,
            )
          }

          if (!metadata.client_uri) {
            throw new InvalidRedirectUriError(
              `Private-Use URI Scheme redirect URI requires a client_uri metadata field`,
            )
          }

          const clientUri = new URL(metadata.client_uri)

          if (clientUri.hostname === 'localhost') {
            throw new InvalidRedirectUriError(
              `Private-Use URI Scheme are not allowed for loopback clients`,
            )
          }

          if (!clientUri.hostname.includes('.') || isIp(clientUri.hostname)) {
            throw new InvalidRedirectUriError(
              `Private-Use URI Scheme require a fully qualified domain name (FQDN) client_uri`,
            )
          }

          const protocol = `${clientUri.hostname.split('.').reverse().join('.')}:`
          if (url.protocol !== protocol) {
            throw new InvalidRedirectUriError(
              `Private-Use URI Scheme redirect URI must be the client_uri domain name, in reverse order (${protocol})`,
            )
          }

          // > Following the requirements of Section 3.2 of [RFC3986], as
          // > there is no naming authority for private-use URI scheme
          // > redirects, only a single slash ("/") appears after the scheme
          // > component.
          if (
            url.href.startsWith(`${url.protocol}//`) ||
            url.username ||
            url.password ||
            url.hostname ||
            url.port
          ) {
            throw new InvalidRedirectUriError(
              `Private-Use URI Scheme must be in the form ${url.protocol}/<path>`,
            )
          }
          continue
        }

        default:
          throw new InvalidRedirectUriError(
            `Invalid redirect URI scheme "${url.protocol}"`,
          )
      }
    }

    return metadata
  }
}

function buildJsonGetRequest(uri: string, options?: GetCachedOptions) {
  const headers = new Headers([['accept', 'application/json']])
  if (options?.noCache) headers.set('cache-control', 'no-cache')
  return new Request(uri, {
    headers,
    signal: options?.signal,
    redirect: 'error',
  })
}
