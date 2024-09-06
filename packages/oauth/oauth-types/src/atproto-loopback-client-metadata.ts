import { parseOAuthLoopbackClientId } from './oauth-client-id-loopback.js'
import { OAuthClientMetadataInput } from './oauth-client-metadata.js'

export function atprotoLoopbackClientMetadata(
  clientId: string,
): OAuthClientMetadataInput {
  const { searchParams } =
    // throws if not a valid loopback client id
    parseOAuthLoopbackClientId(clientId)

  const redirectUris = searchParams.getAll('redirect_uri')
    ? (searchParams.getAll('redirect_uri') as [string, ...string[]])
    : null

  if (redirectUris) {
    for (const uri of redirectUris) {
      const url = new URL(uri)
      if (url.origin !== 'http://127.0.0.1' && url.origin !== 'http://[::1]') {
        throw new TypeError(
          `Loopback ClientID must use loopback addresses as redirect_uris (got ${uri})`,
        )
      }
    }
  }

  return {
    client_id: clientId,
    client_name: 'Loopback client',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: searchParams.get('scope') ?? 'atproto',
    redirect_uris: redirectUris || [`http://127.0.0.1/`, `http://[::1]/`],
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}
