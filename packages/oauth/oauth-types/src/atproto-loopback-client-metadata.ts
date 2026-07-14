import {
  type AtprotoLoopbackClientIdParams,
  type OAuthLoopbackClientIdConfig,
  buildAtprotoLoopbackClientId,
  parseAtprotoLoopbackClientId,
} from './atproto-loopback-client-id.js'
import type { AtprotoOAuthScope } from './atproto-oauth-scope.js'
import type { OAuthClientIdLoopback } from './oauth-client-id-loopback.js'
import type { OAuthClientMetadataInput } from './oauth-client-metadata.js'
import type { OAuthLoopbackRedirectURI } from './oauth-redirect-uri.js'

export type AtprotoLoopbackClientMetadata = OAuthClientMetadataInput & {
  client_id: OAuthClientIdLoopback
  scope: AtprotoOAuthScope
  redirect_uris: [OAuthLoopbackRedirectURI, ...OAuthLoopbackRedirectURI[]]
}

export function atprotoLoopbackClientMetadata(
  clientId: string,
): AtprotoLoopbackClientMetadata {
  const params = parseAtprotoLoopbackClientId(clientId)
  // Safe to cast because parseAtprotoLoopbackClientId ensures it's a loopback ID
  return buildMetadataInternal(clientId as OAuthClientIdLoopback, params)
}

export function buildAtprotoLoopbackClientMetadata(
  config: OAuthLoopbackClientIdConfig,
): AtprotoLoopbackClientMetadata {
  const clientId = buildAtprotoLoopbackClientId(config)
  return buildMetadataInternal(clientId, parseAtprotoLoopbackClientId(clientId))
}

function buildMetadataInternal(
  clientId: OAuthClientIdLoopback,
  clientParams: AtprotoLoopbackClientIdParams,
): AtprotoLoopbackClientMetadata {
  return {
    client_id: clientId,
    scope: clientParams.scope,
    redirect_uris: clientParams.redirect_uris,
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  }
}
