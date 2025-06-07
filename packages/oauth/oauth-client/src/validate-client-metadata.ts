import { Keyset } from '@atproto/jwk'
import {
  OAuthClientMetadataInput,
  assertOAuthDiscoverableClientId,
  assertOAuthLoopbackClientId,
} from '@atproto/oauth-types'
import { FALLBACK_ALG } from './constants.js'
import { ClientMetadata, clientMetadataSchema } from './types.js'

export function validateClientMetadata(
  input: OAuthClientMetadataInput,
  keyset?: Keyset,
): ClientMetadata {
  // Allow to pass a keyset and omit the jwks/jwks_uri properties
  if (!input.jwks && !input.jwks_uri && keyset?.size) {
    input = { ...input, jwks: keyset.toJSON() }
  }

  const metadata = clientMetadataSchema.parse(input)

  // Validate client ID
  if (metadata.client_id.startsWith('http:')) {
    assertOAuthLoopbackClientId(metadata.client_id)
  } else {
    assertOAuthDiscoverableClientId(metadata.client_id)
  }

  const scopes = metadata.scope?.split(' ')
  if (!scopes?.includes('atproto')) {
    throw new TypeError(`Client metadata must include the "atproto" scope`)
  }

  if (!metadata.response_types.includes('code')) {
    throw new TypeError(`"response_types" must include "code"`)
  }

  if (!metadata.grant_types.includes('authorization_code')) {
    throw new TypeError(`"grant_types" must include "authorization_code"`)
  }

  const method = metadata.token_endpoint_auth_method
  const methodAlg = metadata.token_endpoint_auth_signing_alg
  switch (method) {
    case 'none':
      if (methodAlg) {
        throw new TypeError(
          `"token_endpoint_auth_signing_alg" must not be provided when "token_endpoint_auth_method" is "${method}"`,
        )
      }
      break

    case 'private_key_jwt': {
      if (!methodAlg) {
        throw new TypeError(
          `"token_endpoint_auth_signing_alg" must be provided when "token_endpoint_auth_method" is "${method}"`,
        )
      }

      const signingKeys = keyset
        ? Array.from(keyset.list({ use: 'sig' })).filter(
            (key) => key.isPrivate && key.kid,
          )
        : null

      if (!signingKeys?.some((key) => key.algorithms.includes(FALLBACK_ALG))) {
        throw new TypeError(
          `Client authentication method "${method}" requires at least one "${FALLBACK_ALG}" signing key with a "kid" property`,
        )
      }

      if (metadata.jwks) {
        // Ensure that all the signing keys that could end-up being used are
        // advertised in the JWKS.
        for (const key of signingKeys) {
          if (!metadata.jwks.keys.some((k) => k.kid === key.kid)) {
            throw new TypeError(`Key with kid "${key.kid}" not found in jwks`)
          }
        }
      } else if (metadata.jwks_uri) {
        // @NOTE we only ensure that all the signing keys are referenced in JWKS
        // when it is available (see previous "if") as we don't want to download
        // that file here (for efficiency reasons).
      } else {
        throw new TypeError(
          `Client authentication method "${method}" requires a JWKS`,
        )
      }

      break
    }

    default:
      throw new TypeError(
        `Unsupported "token_endpoint_auth_method" value: ${method}`,
      )
  }

  return metadata
}
