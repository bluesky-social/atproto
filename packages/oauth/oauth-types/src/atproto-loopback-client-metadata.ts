import { isOAuthClientIdLoopback } from './oauth-client-id-loopback.js'
import { OAuthClientMetadataInput } from './oauth-client-metadata.js'
import { parseOAuthClientIdUrl } from './oauth-client-id-url.js'

export function atprotoLoopbackClientMetadata(
  clientId: string,
): OAuthClientMetadataInput {
  if (!isOAuthClientIdLoopback(clientId)) {
    throw new TypeError(`Invalid loopback client ID ${clientId}`)
  }

  const { origin, pathname, searchParams } = parseOAuthClientIdUrl(clientId)

  return {
    client_id: clientId,
    client_name: 'Loopback client',
    response_types: ['code id_token', 'code'],
    grant_types: ['authorization_code', 'implicit', 'refresh_token'],
    scope: 'openid profile offline_access',
    redirect_uris: searchParams.has('redirect_uri')
      ? (searchParams.getAll('redirect_uri') as [string, ...string[]])
      : (['127.0.0.1', '[::1]'].map(
          (ip) =>
            Object.assign(new URL(pathname, origin), { hostname: ip }).href,
        ) as [string, ...string[]]),
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}
