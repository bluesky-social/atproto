import { Keyset } from '@atproto/jwk'

import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { InvalidRedirectUriError } from '../errors/invalid-redirect-uri-error.js'
import { OAuthError } from '../errors/oauth-error.js'
import { ClientData } from './client-data.js'
import { ClientHooks } from './client-hooks.js'
import { ClientId } from './client-id.js'
import { ClientStore } from './client-store.js'
import { parseRedirectUri } from './client-utils.js'
import { Client } from './client.js'

export class ClientManager {
  constructor(
    protected readonly store: ClientStore,
    protected readonly keyset: Keyset,
    protected readonly hooks: ClientHooks,
  ) {}

  /**
   * This method will ensure that the client metadata is valid w.r.t. the OAuth
   * and OIDC specifications. It will also ensure that the metadata is
   * compatible with this implementation.
   */
  protected async findClient(clientId: ClientId): Promise<ClientData> {
    try {
      const { metadata, jwks } = await this.store.findClient(clientId)

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

      for (const responseType of metadata.response_types) {
        const rt = responseType.split(' ')

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

      for (const endpoint of [
        'token',
        'introspection',
        'revocation',
      ] as const) {
        const method =
          metadata[`${endpoint}_endpoint_auth_method`] ||
          metadata[`token_endpoint_auth_method`]

        switch (method || null) {
          case 'none':
            break
          case 'private_key_jwt':
            if (!(jwks || metadata.jwks)?.keys.length) {
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

          case null:
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

      if (
        metadata.authorization_encrypted_response_enc &&
        !metadata.authorization_encrypted_response_alg
      ) {
        throw new InvalidClientMetadataError(
          'authorization_encrypted_response_enc requires authorization_encrypted_response_alg',
        )
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
          // Loopback Interface Redirection
          // https://datatracker.ietf.org/doc/html/rfc8252#section-7.3
          case url.hostname === 'localhost':
          case url.hostname === '127.0.0.1':
          case url.hostname === '[::1]': {
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

          // Claimed "https" Scheme URI Redirection
          // https://datatracker.ietf.org/doc/html/rfc8252#section-7.2
          case url.protocol === 'https:':
          case url.protocol === 'http:': {
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

            if (!clientUri.hostname.includes('.')) {
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

      await this.hooks.onClientData?.(clientId, { metadata, jwks })

      return { metadata, jwks }
    } catch (err) {
      if (err instanceof OAuthError) throw err
      if ((err as any)?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        throw new InvalidClientMetadataError('Self-signed certificate', err)
      }
      throw new InvalidClientMetadataError('Unable to obtain metadata', err)
    }
  }

  /**
   *
   * @see {@link https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2 OIDC Client Registration}
   */
  async getClient(clientId: string) {
    const { metadata, jwks } = await this.findClient(clientId)
    return new Client(clientId, metadata, jwks)
  }
}
