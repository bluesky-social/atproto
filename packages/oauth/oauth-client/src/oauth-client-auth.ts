import { Keyset } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationServerMetadata,
  OAuthClientCredentials,
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
  const method = clientMetadata['token_endpoint_auth_method']

  // @NOTE ATproto spec requires that AS support both "none" and
  // "client_secret_jwt", and that clients use one of the other. The following
  // check ensures that the AS is indeed compliant with this client's
  // configuration.
  const methodsSupported =
    serverMetadata['token_endpoint_auth_methods_supported']
  if (!methodsSupported.includes(method)) {
    throw new Error(
      `The server does not support "${method}" authentication. Supported methods are: ${methodsSupported.join(
        ', ',
      )}.`,
    )
  }

  if (method === 'client_secret_jwt') {
    if (!keyset) throw new Error('A keyset is required for client_secret_jwt')

    // Use the first key from the key set that matches the server's supported
    // algorithms.
    for (const { kid } of keyset.list({
      use: 'sig',
      alg: supportedAlgs(serverMetadata),
    })) {
      if (kid) return { method: 'client_secret_jwt', kid }
    }
  }

  if (method === 'none') {
    return { method: 'none' }
  }

  throw new Error(
    `The ATProto OAuth spec requires that client use either "none" or "client_secret_jwt" authentication method.` +
      (method === 'client_secret_basic'
        ? ' You might want to explicitly set "token_endpoint_auth_method" to one of those values in the client metadata document.'
        : ` You set "${method}" which is not allowed.`),
  )
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

    // @NOTE throws if the key is no longer present in the keyset
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
