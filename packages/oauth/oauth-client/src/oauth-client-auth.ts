import { Keyset } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationServerMetadata,
  OAuthClientCredentials,
} from '@atproto/oauth-types'
import { FALLBACK_ALG } from './constants.js'
import { AuthMethodUnsatisfiableError } from './errors/auth-method-unsatisfiable-error.js'
import { Runtime } from './runtime.js'
import { ClientMetadata } from './types.js'
import { Awaitable } from './util.js'

export type ClientAuthMethod =
  | { method: 'none' }
  | { method: 'private_key_jwt'; kid: string }

export function negotiateClientAuthMethod(
  serverMetadata: OAuthAuthorizationServerMetadata,
  clientMetadata: ClientMetadata,
  keyset?: Keyset,
): ClientAuthMethod {
  const method = clientMetadata.token_endpoint_auth_method

  // @NOTE ATproto spec requires that AS support both "none" and
  // "private_key_jwt", and that clients use one of the other. The following
  // check ensures that the AS is indeed compliant with this client's
  // configuration.
  const methods = supportedMethods(serverMetadata)
  if (!methods.includes(method)) {
    throw new Error(
      `The server does not support "${method}" authentication. Supported methods are: ${methods.join(
        ', ',
      )}.`,
    )
  }

  if (method === 'private_key_jwt') {
    // Invalid client configuration. This should not happen as
    // "validateClientMetadata" already check this.
    if (!keyset) throw new Error('A keyset is required for private_key_jwt')

    const alg = supportedAlgs(serverMetadata)

    // @NOTE we can't use `keyset.findPrivateKey` here because we can't enforce
    // that the returned key contains a "kid". The following implementation is
    // more robust against keysets containing keys without a "kid" property.
    for (const key of keyset.list({ use: 'sig', alg })) {
      // Return the first key from the key set that matches the server's
      // supported algorithms.
      if (key.isPrivate && key.kid) {
        return { method: 'private_key_jwt', kid: key.kid }
      }
    }

    throw new Error(
      alg.includes(FALLBACK_ALG)
        ? `Client authentication method "${method}" requires at least one "${FALLBACK_ALG}" signing key with a "kid" property`
        : // AS is not compliant with the ATproto OAuth spec.
          `Authorization server requires "${method}" authentication method, but does not support "${FALLBACK_ALG}" algorithm.`,
    )
  }

  if (method === 'none') {
    return { method: 'none' }
  }

  throw new Error(
    `The ATProto OAuth spec requires that client use either "none" or "private_key_jwt" authentication method.` +
      (method === 'client_secret_basic'
        ? ' You might want to explicitly set "token_endpoint_auth_method" to one of those values in the client metadata document.'
        : ` You set "${method}" which is not allowed.`),
  )
}

export type ClientCredentialsFactory = () => Awaitable<{
  headers?: Record<string, string>
  payload?: OAuthClientCredentials
}>

/**
 * @throws {AuthMethodUnsatisfiableError} if the authentication method is no
 * long usable (either because the AS changed, of because the key is no longer
 * available in the keyset).
 */
export function createClientCredentialsFactory(
  authMethod: ClientAuthMethod,
  serverMetadata: OAuthAuthorizationServerMetadata,
  clientMetadata: ClientMetadata,
  runtime: Runtime,
  keyset?: Keyset,
): ClientCredentialsFactory {
  // Ensure the AS still supports the auth method.
  if (!supportedMethods(serverMetadata).includes(authMethod.method)) {
    throw new AuthMethodUnsatisfiableError(
      `Client authentication method "${authMethod.method}" no longer supported`,
    )
  }

  if (authMethod.method === 'none') {
    return () => ({
      payload: {
        client_id: clientMetadata.client_id,
      },
    })
  }

  if (authMethod.method === 'private_key_jwt') {
    try {
      // The client used to be a confidential client but no longer has a keyset.
      if (!keyset) throw new Error('A keyset is required for private_key_jwt')

      // @NOTE throws if no matching key can be found
      const { key, alg } = keyset.findPrivateKey({
        use: 'sig',
        kid: authMethod.kid,
        alg: supportedAlgs(serverMetadata),
      })

      // https://www.rfc-editor.org/rfc/rfc7523.html#section-3
      return async () => ({
        payload: {
          client_id: clientMetadata.client_id,
          client_assertion_type: CLIENT_ASSERTION_TYPE_JWT_BEARER,
          client_assertion: await key.createJwt(
            { alg },
            {
              // > The JWT MUST contain an "iss" (issuer) claim that contains a
              // > unique identifier for the entity that issued the JWT.
              iss: clientMetadata.client_id,
              // > For client authentication, the subject MUST be the
              // > "client_id" of the OAuth client.
              sub: clientMetadata.client_id,
              // > The JWT MUST contain an "aud" (audience) claim containing a value
              // > that identifies the authorization server as an intended audience.
              // > The token endpoint URL of the authorization server MAY be used as a
              // > value for an "aud" element to identify the authorization server as an
              // > intended audience of the JWT.
              aud: serverMetadata.issuer,
              // > The JWT MAY contain a "jti" (JWT ID) claim that provides a
              // > unique identifier for the token.
              jti: await runtime.generateNonce(),
              // > The JWT MAY contain an "iat" (issued at) claim that
              // > identifies the time at which the JWT was issued.
              iat: Math.floor(Date.now() / 1000),
              // > The JWT MUST contain an "exp" (expiration time) claim that
              // > limits the time window during which the JWT can be used.
              exp: Math.floor(Date.now() / 1000) + 60, // 1 minute
            },
          ),
        },
      })
    } catch (cause) {
      throw new AuthMethodUnsatisfiableError('Failed to load private key', {
        cause,
      })
    }
  }

  throw new AuthMethodUnsatisfiableError(
    // @ts-expect-error
    `Unsupported auth method ${authMethod.method}`,
  )
}

function supportedMethods(serverMetadata: OAuthAuthorizationServerMetadata) {
  return serverMetadata['token_endpoint_auth_methods_supported']
}

function supportedAlgs(serverMetadata: OAuthAuthorizationServerMetadata) {
  return (
    serverMetadata['token_endpoint_auth_signing_alg_values_supported'] ?? [
      // @NOTE If not specified, assume that the server supports the ES256
      // algorithm, as prescribed by the spec:
      //
      // > Clients and Authorization Servers currently must support the ES256
      // > cryptographic system [for client authentication].
      //
      // https://atproto.com/specs/oauth#confidential-client-authentication
      FALLBACK_ALG,
    ]
  )
}
