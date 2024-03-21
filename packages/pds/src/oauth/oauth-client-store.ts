import {
  ClientStore,
  InvalidClientMetadataError,
  InvalidRedirectUriError,
  OAuthClientId,
  OAuthClientMetadata,
  parseRedirectUri,
} from '@atproto/oauth-provider'
import {
  OAuthClientUriStore,
  OAuthClientUriStoreConfig,
} from '@atproto/oauth-provider-client-uri'
import { isAbsolute, relative } from 'node:path'

export class OauthClientStore
  extends OAuthClientUriStore
  implements ClientStore
{
  constructor({ fetch }: Pick<OAuthClientUriStoreConfig, 'fetch'>) {
    super({
      fetch,
      loopbackMetadata,
      validateMetadata,
    })
  }
}

/**
 * Allow "loopback" clients using the following client metadata (as defined in
 * the ATPROTO spec).
 */
function loopbackMetadata({ href }: URL): Partial<OAuthClientMetadata> {
  return {
    client_name: 'Loopback ATPROTO client',
    client_uri: href,
    response_types: ['code', 'code id_token'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: 'profile offline_access',
    redirect_uris: ['127.0.0.1', '[::1]'].map(
      (ip) => Object.assign(new URL(href), { hostname: ip }).href,
    ) as [string, string],
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}

/**
 * Make sure that fetched metadata are spec compliant
 */
function validateMetadata(
  clientId: OAuthClientId,
  clientUrl: URL,
  metadata: OAuthClientMetadata,
) {
  // ATPROTO spec requires the use of DPoP (default is false)
  if (metadata.dpop_bound_access_tokens !== true) {
    throw new InvalidClientMetadataError(
      '"dpop_bound_access_tokens" must be true',
    )
  }

  // ATPROTO spec requires the use of PKCE
  if (metadata.response_types.some((rt) => rt.split(' ').includes('token'))) {
    throw new InvalidClientMetadataError(
      '"token" response type is not compatible with PKCE (use "code" instead)',
    )
  }

  for (const redirectUri of metadata.redirect_uris) {
    const uri = parseRedirectUri(redirectUri)

    switch (true) {
      case uri.protocol === 'http:':
        // Only loopback redirect URIs are allowed to use HTTP
        switch (uri.hostname) {
          // ATPROTO spec requires that the IP is used in case of loopback redirect URIs
          case '127.0.0.1':
          case '[::1]':
            continue

          // ATPROTO spec forbids use of localhost as redirect URI hostname
          case 'localhost':
            throw new InvalidRedirectUriError(
              `Loopback redirect URI ${uri} is not allowed (use explicit IPs instead)`,
            )
        }

        // ATPROTO spec forbids http redirects (except for loopback, covered before)
        throw new InvalidRedirectUriError(`Redirect URI ${uri} must use HTTPS`)

      // ATPROTO spec requires that the redirect URI is a sub-url of the client URL
      case uri.protocol === 'https:':
        if (!isSubUrl(clientUrl, uri)) {
          throw new InvalidRedirectUriError(
            `Redirect URI ${uri} must be a sub-url of ${clientUrl}`,
          )
        }
        continue

      // Custom URI schemes are allowed by ATPROTO, following the rules
      // defined in the spec & current best practices. These are already
      // enforced by the @atproto/oauth-provider &
      // @atproto/oauth-provider-client-uri packages.
      default:
        continue
    }
  }
}

function isSubUrl(reference: URL, url: URL): boolean {
  if (url.origin !== reference.origin) return false
  if (url.username !== reference.username) return false
  if (url.password !== reference.password) return false

  return (
    reference.pathname === url.pathname ||
    isSubPath(reference.pathname, url.pathname)
  )
}

function isSubPath(reference: string, path: string): boolean {
  const rel = relative(reference, path)
  return !rel.startsWith('..') && !isAbsolute(rel)
}
