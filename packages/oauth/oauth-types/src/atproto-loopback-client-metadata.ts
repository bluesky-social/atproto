import { parseOAuthLoopbackClientId } from './oauth-client-id-loopback.js'
import { OAuthClientMetadataInput } from './oauth-client-metadata.js'

export function atprotoLoopbackClientMetadata(
  clientId: string,
): OAuthClientMetadataInput {
  const {
    scope = 'atproto',
    redirect_uris = [`http://127.0.0.1/`, `http://[::1]/`],
  } = parseOAuthLoopbackClientId(clientId)

  return {
    client_id: clientId,
    scope,
    redirect_uris,
    client_name: 'Loopback client',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}
