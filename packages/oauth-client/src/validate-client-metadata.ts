import { Keyset } from '@atproto/jwk'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'

export function validateClientMetadata(
  metadata: OAuthClientMetadata,
  keyset?: Keyset,
): asserts metadata is OAuthClientMetadata & { client_id: string } {
  if (!metadata.client_id) {
    throw new TypeError('client_id must be provided')
  }

  const url = new URL(metadata.client_id)
  if (url.pathname !== '/') {
    throw new TypeError('origin must be a URL root')
  }
  if (url.href !== metadata.client_id) {
    throw new TypeError('client_id must be a normalized URL')
  }

  if (metadata.client_uri && metadata.client_uri !== metadata.client_id) {
    throw new TypeError('client_uri must match client_id')
  }

  if (!metadata.redirect_uris.length) {
    throw new TypeError('At least one redirect_uri must be provided')
  }
  for (const u of metadata.redirect_uris) {
    const redirectUrl = new URL(u)
    if (redirectUrl.origin !== url.origin) {
      throw new TypeError('redirect_uris must have the same origin')
    }
  }

  for (const endpoint of [
    'token',
    'revocation',
    'introspection',
    'pushed_authorization_request',
  ] as const) {
    const method = metadata[`${endpoint}_endpoint_auth_method`]
    if (method && method !== 'none') {
      if (!keyset) {
        throw new TypeError(`Keyset is required for ${method} method`)
      }
      if (!metadata[`${endpoint}_endpoint_auth_signing_alg`]) {
        throw new TypeError(
          `${endpoint}_endpoint_auth_signing_alg must be provided`,
        )
      }
    }
  }
}
