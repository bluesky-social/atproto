import {
  bindFetch,
  Fetch,
  fetchJsonProcessor,
  fetchJsonZodProcessor,
  fetchOkProcessor,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import {
  CachedGetter,
  GetCachedOptions,
  SimpleStore,
} from '@atproto-labs/simple-store'
import { Jwks, jwksSchema, Keyset } from '@atproto/jwk'
import {
  isLoopbackHost,
  isLoopbackUrl,
  isOAuthClientIdDiscoverable,
  isOAuthClientIdLoopback,
  OAUTH_AUTHENTICATED_ENDPOINT_NAMES,
  OAuthClientIdDiscoverable,
  OAuthClientIdLoopback,
  OAuthClientMetadata,
  OAuthClientMetadataInput,
  oauthClientMetadataSchema,
} from '@atproto/oauth-types'

import { ALLOW_LOOPBACK_CLIENT_REFRESH_TOKEN } from '../constants.js'
import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { InvalidRedirectUriError } from '../errors/invalid-redirect-uri-error.js'
import { OAuthError } from '../errors/oauth-error.js'
import { parseDomain, parseUrlDomain } from '../lib/util/hostname.js'
import { Awaitable } from '../lib/util/type.js'
import { OAuthHooks } from '../oauth-hooks.js'
import { ClientId } from './client-id.js'
import { ClientStore } from './client-store.js'
import { parseDiscoverableClientId, parseRedirectUri } from './client-utils.js'
import { Client } from './client.js'

const fetchMetadataHandler = pipe(
  fetchOkProcessor(),
  // https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html#section-4.1
  fetchJsonProcessor('application/json', true),
  fetchJsonZodProcessor(oauthClientMetadataSchema),
)

const fetchJwksHandler = pipe(
  fetchOkProcessor(),
  fetchJsonProcessor('application/json', false),
  fetchJsonZodProcessor(jwksSchema),
)

export type LoopbackMetadataGetter = (
  url: string,
) => Awaitable<OAuthClientMetadataInput>

export class ClientManager {
  protected readonly jwks: CachedGetter<string, Jwks>
  protected readonly metadata: CachedGetter<string, OAuthClientMetadata>

  constructor(
    protected readonly keyset: Keyset,
    protected readonly hooks: OAuthHooks,
    protected readonly store: ClientStore | null,
    protected readonly loopbackMetadata: LoopbackMetadataGetter | null = null,
    safeFetch: Fetch,
    clientJwksCache: SimpleStore<string, Jwks>,
    clientMetadataCache: SimpleStore<string, OAuthClientMetadata>,
  ) {
    const fetch = bindFetch(safeFetch)

    this.jwks = new CachedGetter(async (uri, options) => {
      const jwks = await fetch(buildJsonGetRequest(uri, options)).then(
        fetchJwksHandler,
      )

      return jwks
    }, clientJwksCache)

    this.metadata = new CachedGetter(async (uri, options) => {
      const metadata = await fetch(buildJsonGetRequest(uri, options)).then(
        fetchMetadataHandler,
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

      const partialInfo = await this.hooks.onClientInfo?.(clientId, {
        metadata,
        jwks,
      })

      const isFirstParty = partialInfo?.isFirstParty ?? false
      const isTrusted =
        partialInfo?.isTrusted ??
        (isFirstParty ||
          // If the client was loaded from the store, we consider it trusted:
          (!isOAuthClientIdLoopback(clientId) &&
            !isOAuthClientIdDiscoverable(clientId)))

      return new Client(clientId, metadata, jwks, { isFirstParty, isTrusted })
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
    if (isOAuthClientIdLoopback(clientId)) {
      return this.getLoopbackClientMetadata(clientId)
    } else if (isOAuthClientIdDiscoverable(clientId)) {
      return this.getDiscoverableClientMetadata(clientId)
    } else if (this.store) {
      return this.getStoredClientMetadata(clientId)
    }

    throw new InvalidClientMetadataError(`Invalid client ID "${clientId}"`)
  }

  protected async getLoopbackClientMetadata(
    clientId: OAuthClientIdLoopback,
  ): Promise<OAuthClientMetadata> {
    const { loopbackMetadata } = this
    if (!loopbackMetadata) {
      throw new InvalidClientMetadataError('Loopback clients are not allowed')
    }

    const result = oauthClientMetadataSchema.safeParse(
      await loopbackMetadata(clientId),
    )

    if (!result.success) {
      throw InvalidClientMetadataError.from(result.error)
    }

    return this.validateClientMetadata(clientId, result.data)
  }

  protected async getDiscoverableClientMetadata(
    clientId: OAuthClientIdDiscoverable,
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

    const clientUriUrl = metadata.client_uri
      ? new URL(metadata.client_uri)
      : null
    const clientUriParsed = clientUriUrl ? parseUrlDomain(clientUriUrl) : null

    if (clientUriUrl && !clientUriParsed) {
      throw new InvalidClientMetadataError('client_uri must be a valid URL')
    }

    const scopes = metadata.scope?.split(' ')
    if (
      metadata.grant_types.includes('refresh_token') !==
      (scopes?.includes('offline_access') ?? false)
    ) {
      throw new InvalidClientMetadataError(
        'Grant type "refresh_token" requires scope "offline_access" (and vice versa)',
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

    if (metadata.client_id && metadata.client_id !== clientId) {
      throw new InvalidClientMetadataError('client_id does not match')
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

    if (!metadata[`token_endpoint_auth_method`]) {
      throw new InvalidClientMetadataError(
        'Missing token_endpoint_auth_method client metadata',
      )
    }

    for (const endpoint of OAUTH_AUTHENTICATED_ENDPOINT_NAMES) {
      const method =
        metadata[`${endpoint}_endpoint_auth_method`] ||
        metadata[`token_endpoint_auth_method`]

      switch (method) {
        case 'none':
          if (metadata.token_endpoint_auth_signing_alg) {
            throw new InvalidClientMetadataError(
              `${endpoint}_endpoint_auth_method "none" must not have ${endpoint}_endpoint_auth_signing_alg`,
            )
          }
          break

        case 'private_key_jwt':
          if (!metadata.jwks && !metadata.jwks_uri) {
            throw new InvalidClientMetadataError(
              `private_key_jwt auth method requires jwks or jwks_uri`,
            )
          }
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

        default:
          throw new InvalidClientMetadataError(
            `${method} is not a supported "${endpoint}_endpoint_auth_method". Use "private_key_jwt" or "none".`,
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

      // Consistency check
      if (
        rt.includes('code') &&
        !metadata.grant_types.includes('authorization_code')
      ) {
        throw new InvalidClientMetadataError(
          `Response type "${responseType}" requires the "authorization_code" grant type`,
        )
      }

      // Asking for "code token" or "code id_token" is fine (as long as the
      // grant_types includes "authorization_code" and the scope includes
      // "openid"). Asking for "token" or "id_token" (without "code") requires
      // the "implicit" grant type.
      if (
        (rt.includes('token') || rt.includes('id_token')) &&
        !metadata.grant_types.includes('implicit')
      ) {
        throw new InvalidClientMetadataError(
          `Response type "${responseType}" requires the "implicit" grant type`,
        )
      }
    }

    if (metadata.application_type === 'native') {
      // https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
      //
      // > Except when using a mechanism like Dynamic Client Registration
      // > [RFC7591] to provision per-instance secrets, native apps are
      // > classified as public clients, as defined by Section 2.1 of OAuth 2.0
      // > [RFC6749]; they MUST be registered with the authorization server as
      // > such.  Authorization servers MUST record the client type in the
      // > client registration details in order to identify and process requests
      // > accordingly.
    }

    if (!metadata.redirect_uris?.length) {
      // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
      //
      // >  OPs can require that request_uri values used be pre-registered with
      // > the require_request_uri_registration discovery parameter.

      throw new InvalidClientMetadataError(
        'At least one redirect_uri is required',
      )
    }

    if (
      metadata.application_type === 'web' &&
      metadata.grant_types.includes('implicit')
    ) {
      // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
      //
      // > Web Clients [as defined by "application_type"] using the OAuth
      // > Implicit Grant Type MUST only register URLs using the https
      // > scheme as redirect_uris; they MUST NOT use localhost as the
      // > hostname.

      for (const redirectUri of metadata.redirect_uris) {
        const url = parseRedirectUri(redirectUri)
        if (url.protocol !== 'https:') {
          throw new InvalidRedirectUriError(
            `Web clients must use HTTPS redirect URIs`,
          )
        }

        if (url.hostname === 'localhost') {
          throw new InvalidRedirectUriError(
            `Web clients must not use localhost as the hostname`,
          )
        }
      }
    }

    if (metadata.application_type === 'native') {
      // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
      //
      // > Native Clients [as defined by "application_type"] MUST only
      // > register redirect_uris using custom URI schemes or loopback URLs
      // > using the http scheme; loopback URLs use localhost or the IP
      // > loopback literals 127.0.0.1 or [::1] as the hostname.

      for (const redirectUri of metadata.redirect_uris) {
        const url = parseRedirectUri(redirectUri)
        if (url.protocol !== 'http:') {
          throw new InvalidRedirectUriError(
            `Native clients must use HTTP redirect URIs (got ${url})`,
          )
        }

        if (!isLoopbackHost(url.hostname) && !isPrivateUseUriScheme(url)) {
          throw new InvalidRedirectUriError(
            'Loopback redirect URIs are only allowed for native apps',
          )
        }
      }
    }

    if (metadata.application_type === 'native') {
      // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
      //
      // > Authorization Servers MAY reject Redirection URI values using
      // > the http scheme, other than the loopback case for Native
      // > Clients.

      for (const redirectUri of metadata.redirect_uris) {
        const url = parseRedirectUri(redirectUri)
        if (url.protocol === 'http:' && !isLoopbackUrl(url)) {
          throw new InvalidRedirectUriError(
            `Native clients must not use HTTP redirect URIs (got ${url})`,
          )
        }
      }
    }

    for (const redirectUri of metadata.redirect_uris) {
      const url = parseRedirectUri(redirectUri)

      if (url.username || url.password) {
        // Is this a valid concern? Should we allow credentials in the URI?
        throw new InvalidRedirectUriError(
          `Redirect URI ${url} must not contain credentials`,
        )
      }

      switch (true) {
        // FIRST: Loopback redirect URI exception (only for native apps)

        case url.hostname === 'localhost': {
          // https://datatracker.ietf.org/doc/html/rfc8252#section-8.3
          //
          // > While redirect URIs using localhost (i.e.,
          // > "http://localhost:{port}/{path}") function similarly to loopback IP
          // > redirects described in Section 7.3, the use of localhost is NOT
          // > RECOMMENDED. Specifying a redirect URI with the loopback IP literal
          // > rather than localhost avoids inadvertently listening on network
          // > interfaces other than the loopback interface. It is also less
          // > susceptible to client-side firewalls and misconfigured host name
          // > resolution on the user's device.
          throw new InvalidRedirectUriError(
            `Loopback redirect URI ${url} is not allowed (use explicit IPs instead)`,
          )
        }
        // falls through
        case url.hostname === '127.0.0.1':
        case url.hostname === '[::1]': {
          // https://datatracker.ietf.org/doc/html/rfc8252#section-7.3
          //
          // > Loopback redirect URIs use the "http" scheme and are constructed
          // > with the loopback IP literal and whatever port the client is
          // > listening on. That is, "http://127.0.0.1:{port}/{path}" for IPv4,
          // > and "http://[::1]:{port}/{path}" for IPv6.

          if (metadata.application_type !== 'native') {
            throw new InvalidRedirectUriError(
              `Loopback redirect URIs are only allowed for native apps`,
            )
          }

          if (url.port) {
            // https://datatracker.ietf.org/doc/html/rfc8252#section-7.3
            //
            // > The authorization server MUST allow any port to be specified at
            // > the time of the request for loopback IP redirect URIs, to
            // > accommodate clients that obtain an available ephemeral port
            // > from the operating system at the time of the request.
            //
            // Note: although validation of the redirect_uri will ignore the
            // port we still allow it to be specified, as the spec does not
            // forbid it. If a port number is specified, ports will need to
            // match when validating authorization requests. See
            // "compareRedirectUri()".
          }

          if (url.protocol !== 'http:') {
            throw new InvalidRedirectUriError(
              `Loopback redirect URI ${url} must use HTTP`,
            )
          }

          break
        }

        // SECOND: Protocol-based URI Redirection

        case url.protocol === 'http:': {
          // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
          //
          // > request_uri [...] URLs MUST use the https scheme unless the
          // > target Request Object is signed in a way that is verifiable by
          // > the OP.
          //
          // TODO: Should we allow this (and check for signed request objects)?
          throw new InvalidRedirectUriError(
            `Non loopback redirect URI ${url} must use HTTPS`,
          )
        }

        case url.protocol === 'https:': {
          const redirectUriDomain = parseUrlDomain(url)
          if (!redirectUriDomain) {
            throw new InvalidRedirectUriError(
              `Redirect URI ${url} must be a valid URL`,
            )
          }

          // https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
          //
          // > In addition to the collision-resistant properties, requiring a
          // > URI scheme based on a domain name that is under the control of
          // > the app can help to prove ownership in the event of a dispute
          // > where two apps claim the same private-use URI scheme (where one
          // > app is acting maliciously).
          //
          // Although this only applies to "native" clients (extract being from
          // rfc8252), we apply this rule to "web" clients as well.
          if (!clientUriParsed) {
            throw new InvalidClientMetadataError(
              'client_uri is required for HTTPS redirect URIs',
            )
          } else {
            if (redirectUriDomain.domain !== clientUriParsed.domain) {
              throw new InvalidRedirectUriError(
                `Redirect URI ${url} must be under the same domain as client_uri ${metadata.client_uri}`,
              )
            }
          }

          break
        }

        case isPrivateUseUriScheme(url): {
          // https://datatracker.ietf.org/doc/html/rfc8252#section-7.1
          //
          // > When choosing a URI scheme to associate with the app, apps MUST
          // > use a URI scheme based on a domain name under their control,
          // > expressed in reverse order, as recommended by Section 3.8 of
          // > [RFC7595] for private-use URI schemes.

          if (metadata.application_type !== 'native') {
            throw new InvalidRedirectUriError(
              `Private-Use URI Scheme redirect URI are only allowed for native apps`,
            )
          }

          const redirectUriDomain = parseDomain(
            reverseDomain(url.protocol.slice(0, -1)),
          )

          if (!redirectUriDomain) {
            throw new InvalidRedirectUriError(
              `Private-use URI Scheme redirect URI must be based on a valid domain name`,
            )
          }

          // https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
          //
          // > In addition to the collision-resistant properties, requiring a
          // > URI scheme based on a domain name that is under the control of
          // > the app can help to prove ownership in the event of a dispute
          // > where two apps claim the same private-use URI scheme (where one
          // > app is acting maliciously).
          if (!clientUriParsed) {
            throw new InvalidClientMetadataError(
              'client_uri is required for native apps using private-use URI Scheme redirect URIs',
            )
          } else {
            if (redirectUriDomain.domain !== clientUriParsed.domain) {
              throw new InvalidRedirectUriError(
                `Private-Use URI Scheme redirect URI ${url} must be under the same domain as client_uri ${metadata.client_uri}`,
              )
            }
          }

          // https://datatracker.ietf.org/doc/html/rfc8252#section-7.1
          //
          // > Following the requirements of Section 3.2 of [RFC3986], as there
          // > is no naming authority for private-use URI scheme redirects, only
          // > a single slash ("/") appears after the scheme component.
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

          break
        }

        default:
          // https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
          //
          // > At a minimum, any private-use URI scheme that doesn't contain a
          // > period character (".") SHOULD be rejected.
          throw new InvalidRedirectUriError(
            `Invalid redirect URI scheme "${url.protocol}"`,
          )
      }
    }

    if (isOAuthClientIdLoopback(clientId)) {
      return this.validateLoopbackClientMetadata(clientId, metadata)
    } else if (isOAuthClientIdDiscoverable(clientId)) {
      return this.validateDiscoverableClientMetadata(clientId, metadata)
    } else {
      return metadata
    }
  }

  validateLoopbackClientMetadata(
    clientId: OAuthClientIdLoopback,
    metadata: OAuthClientMetadata,
  ): OAuthClientMetadata {
    if (metadata.client_uri) {
      throw new InvalidClientMetadataError(
        'client_uri is not allowed for loopback clients',
      )
    }

    if (metadata.application_type !== 'native') {
      throw new InvalidClientMetadataError(
        'Loopback clients must have application_type "native"',
      )
    }

    if (
      !ALLOW_LOOPBACK_CLIENT_REFRESH_TOKEN &&
      metadata.grant_types.includes('refresh_token')
    ) {
      throw new InvalidClientMetadataError(
        'Loopback clients are not allowed to use the "refresh_token" grant type',
      )
    }

    for (const endpoint of OAUTH_AUTHENTICATED_ENDPOINT_NAMES) {
      const method =
        metadata[`${endpoint}_endpoint_auth_method`] ||
        metadata[`token_endpoint_auth_method`]

      if (method !== 'none') {
        throw new InvalidClientMetadataError(
          `Loopback clients are not allowed to use "${endpoint}_endpoint_auth_method" ${method}`,
        )
      }
    }

    for (const redirectUri of metadata.redirect_uris) {
      const url = parseRedirectUri(redirectUri)

      if (url.protocol !== 'http:') {
        throw new InvalidRedirectUriError(
          `Loopback clients must use HTTP redirect URIs`,
        )
      }

      if (!isLoopbackHost(url.hostname)) {
        throw new InvalidRedirectUriError(
          `Loopback clients must use loopback redirect URIs`,
        )
      }
    }

    return metadata
  }

  validateDiscoverableClientMetadata(
    clientId: OAuthClientIdDiscoverable,
    metadata: OAuthClientMetadata,
  ): OAuthClientMetadata {
    if (!metadata.client_id) {
      // https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html
      throw new InvalidClientMetadataError(
        `client_id is required for discoverable clients`,
      )
    }

    const clientIdUrl = parseDiscoverableClientId(clientId)

    if (metadata.client_uri) {
      // https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html
      //
      // The client_uri must be a parent of the client_id URL. This might be
      // relaxed in the future.

      const clientUriUrl = new URL(metadata.client_uri)

      if (clientUriUrl.origin !== clientIdUrl.origin) {
        throw new InvalidClientMetadataError(
          `client_uri must have the same origin as the client_id`,
        )
      }

      if (clientIdUrl.pathname !== clientUriUrl.pathname) {
        if (
          !clientIdUrl.pathname.startsWith(
            clientUriUrl.pathname.endsWith('/')
              ? clientUriUrl.pathname
              : `${clientUriUrl.pathname}/`,
          )
        ) {
          throw new InvalidClientMetadataError(
            `client_uri must be a parent URL of the client_id`,
          )
        }
      }
    }

    for (const endpoint of OAUTH_AUTHENTICATED_ENDPOINT_NAMES) {
      const method = metadata[`${endpoint}_endpoint_auth_method`]
      switch (method) {
        case 'client_secret_post':
        case 'client_secret_basic':
        case 'client_secret_jwt':
          throw new InvalidClientMetadataError(
            `Client authentication method "${method}" is not allowed for discoverable clients`,
          )
      }
    }

    for (const redirectUri of metadata.redirect_uris) {
      const url = parseRedirectUri(redirectUri)

      if (isPrivateUseUriScheme(url)) {
        // https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html
        //
        // Fully qualified domain name (FQDN) of the client_id, in reverse
        // order. This could be relaxed to allow same apex domain names, or
        // parent domains, but for now we require an exact match.
        const protocol = `${reverseDomain(clientIdUrl.hostname)}:`
        if (url.protocol !== protocol) {
          throw new InvalidRedirectUriError(
            `Private-Use URI Scheme redirect URI, for discoverable client metadata, must be the fully qualified domain name (FQDN) of the client_id, in reverse order (${protocol})`,
          )
        }
      }
    }

    return metadata
  }
}

function reverseDomain(domain: string) {
  return domain.split('.').reverse().join('.')
}

function isPrivateUseUriScheme(uri: URL) {
  return uri.protocol.includes('.')
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
