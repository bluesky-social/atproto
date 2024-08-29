import { parseOAuthLoopbackClientId } from './oauth-client-id-loopback.js'
import { OAuthClientMetadataInput } from './oauth-client-metadata.js'

export function atprotoLoopbackClientMetadata(
  clientId: string,
): OAuthClientMetadataInput {
  const { origin, pathname, searchParams } =
    // throws if not a (valid) loopback client
    parseOAuthLoopbackClientId(clientId)

  for (const name of searchParams.keys()) {
    if (name !== 'redirect_uri' && name !== 'scope') {
      throw new TypeError(`Invalid query parameter ${name} in client ID`)
    }
  }

  const redirectUris = searchParams.getAll('redirect_uri')

  const scopes = searchParams.getAll('scope')
  if (scopes.length > 1) {
    throw new TypeError('Multiple scope parameters are not allowed')
  }

  return {
    client_id: clientId,
    client_name: 'Loopback client',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: scopes[0] || 'atproto',
    redirect_uris: (redirectUris.length
      ? redirectUris
      : (['127.0.0.1', '[::1]'] as const).map(
          (ip) =>
            Object.assign(new URL(pathname, origin), { hostname: ip }).href,
        )) as [string, ...string[]],
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}
