import { parseOAuthLoopbackClientId } from './oauth-client-id-loopback.js'
import { OAuthClientMetadataInput } from './oauth-client-metadata.js'

export function atprotoLoopbackClientMetadata(
  clientId: string,
): OAuthClientMetadataInput {
  const { origin, pathname, searchParams } =
    // throws if not a valid loopback client id
    parseOAuthLoopbackClientId(clientId)

  return {
    client_id: clientId,
    client_name: 'Loopback client',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: searchParams.get('scope') ?? 'atproto',
    redirect_uris: (searchParams.has('redirect_uri')
      ? searchParams.getAll('redirect_uri').filter(Boolean)
      : (['127.0.0.1', '[::1]'] as const).map(
          (ip) =>
            Object.assign(new URL(pathname, origin), { hostname: ip }).href,
        )) as [string, ...string[]],
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}
