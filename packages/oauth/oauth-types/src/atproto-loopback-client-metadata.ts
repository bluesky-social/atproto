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

  for (const name of searchParams.keys()) {
    if (name !== 'redirect_uri' && name !== 'scope') {
      throw new TypeError(`Invalid query parameter ${name} in client ID`)
    }
  }
  const redirectUris = searchParams.getAll('redirect_uri')
  const scope = searchParams.get('scope')

  return {
    client_id: clientId,
    client_name: 'Loopback client',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: (redirectUris.length
      ? redirectUris
      : (['127.0.0.1', '[::1]'] as const).map(
          (ip) =>
            Object.assign(new URL(pathname, origin), { hostname: ip }).href,
        )) as [string, ...string[]],
    scope: scope || 'atproto',
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}
