import { Keyset } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationServerMetadata,
  OAuthClientCredentials,
  OauthEndpointAuthMethod,
} from '@atproto/oauth-types'
import { FALLBACK_ALG } from './constants.js'
import { Runtime } from './runtime.js'
import { ClientMetadata } from './types.js'
import { Awaitable } from './util.js'

export type ClientAuthMethod =
  | { method: 'none' }
  | { method: 'client_secret_jwt'; kid: string }

export function negotiateClientAuthMethod(
  serverMetadata: OAuthAuthorizationServerMetadata,
  clientMetadata: ClientMetadata,
  keyset?: Keyset,
): ClientAuthMethod {
  const declaredMethod = clientMetadata['token_endpoint_auth_method']
  const supportedMethods =
    serverMetadata['token_endpoint_auth_methods_supported']

  // Invalid client config
  if (declaredMethod === 'client_secret_jwt' && !keyset) {
    throw new Error(`A keyset is required for "client_secret_jwt" method`)
  }

  // No possible fit
  if (declaredMethod && supportedMethods?.includes(declaredMethod) === false) {
    throw new Error(
      `The client requires a client authentication method that is not supported by the server. Please provide a key suitable for the following authentication methods: ${supportedMethods.join(', ')}`,
    )
  }

  if (methodAllowed(serverMetadata, clientMetadata, 'client_secret_jwt')) {
    if (keyset) {
      for (const { kid } of keyset.list({
        use: 'sig',
        alg: supportedAlgs(serverMetadata),
      })) {
        if (kid) return { method: 'client_secret_jwt', kid }
      }
    }
  }

  // @NOTE last to prioritize "confidential" methods
  if (methodAllowed(serverMetadata, clientMetadata, 'none')) {
    return { method: 'none' }
  }

  throw new Error(`Unable to negotiate authentication method with server`)
}

export type ClientAuthenticator = () => Awaitable<OAuthClientCredentials>
export function buildClientAuthenticator(
  authMethod: ClientAuthMethod,
  serverMetadata: OAuthAuthorizationServerMetadata,
  clientMetadata: ClientMetadata,
  runtime: Runtime,
  keyset?: Keyset,
): ClientAuthenticator {
  if (authMethod.method === 'none') {
    return () => ({
      client_id: clientMetadata.client_id,
    })
  }

  if (authMethod.method === 'client_secret_jwt') {
    if (!keyset) throw new Error('A keyset is required for client_secret_jwt')

    const [key, alg] = keyset.findKey({
      use: 'sig',
      kid: authMethod.kid,
      alg: supportedAlgs(serverMetadata),
    })

    return async () => ({
      client_id: clientMetadata.client_id,
      client_assertion_type: CLIENT_ASSERTION_TYPE_JWT_BEARER,
      client_assertion: await key.createJwt(
        { alg },
        {
          iss: clientMetadata.client_id,
          sub: clientMetadata.client_id,
          aud: serverMetadata.issuer,
          jti: await runtime.generateNonce(),
          iat: Math.floor(Date.now() / 1000),
        },
      ),
    })
  }

  // @ts-expect-error
  throw new Error(`Unsupported auth method ${authMethod.method}`)
}

function supportedAlgs(
  serverMetadata: OAuthAuthorizationServerMetadata,
): string[] {
  return (
    serverMetadata['token_endpoint_auth_signing_alg_values_supported'] ?? [
      // @TODO Make sure that this fallback is reflected in the spec
      FALLBACK_ALG,
    ]
  )
}

function methodAllowed(
  serverMetadata: OAuthAuthorizationServerMetadata,
  clientMetadata: ClientMetadata,
  method: OauthEndpointAuthMethod,
): boolean {
  const declaredMethod = clientMetadata['token_endpoint_auth_method']
  const supportedMethods =
    serverMetadata['token_endpoint_auth_methods_supported']

  return (
    (!declaredMethod || declaredMethod === method) &&
    // https://www.rfc-editor.org/rfc/rfc8414.html
    // > If omitted, the default is "client_secret_basic"
    (supportedMethods?.includes(method) ?? method === 'client_secret_basic')
  )
}
