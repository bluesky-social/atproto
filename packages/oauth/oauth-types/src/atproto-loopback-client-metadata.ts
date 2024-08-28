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

  // Allows both a single space separated string, multiple individual values, or
  // a mix of both.
  const scope = searchParams.getAll('scope').join(' ')

  return {
    client_id: clientId,
    client_name: 'Loopback client',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: scope || 'atproto',
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
