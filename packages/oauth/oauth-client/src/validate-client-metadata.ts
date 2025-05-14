import { Keyset } from '@atproto/jwk'
import {
  OAuthClientMetadataInput,
  assertOAuthDiscoverableClientId,
  assertOAuthLoopbackClientId,
} from '@atproto/oauth-types'
import { FALLBACK_ALG } from './constants.js'
import { ClientMetadata, clientMetadataSchema } from './types.js'

const TOKEN_ENDPOINT_AUTH_METHOD = `token_endpoint_auth_method`
const TOKEN_ENDPOINT_AUTH_SIGNING_ALG = `token_endpoint_auth_signing_alg`

export function validateClientMetadata(
  input: OAuthClientMetadataInput,
  keyset?: Keyset,
): ClientMetadata {
  // Allow to pass a keyset and omit the jwks/jwks_uri properties
  if (!input.jwks && !input.jwks_uri && keyset?.size) {
    input = { ...input, jwks: keyset.toJSON() }
  }

  if (input.jwks) {
    for (const { kid } of input.jwks.keys) {
      if (!kid) {
        throw new TypeError(`Every key in the JWKS must have a "kid" property`)
      }
    }
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

  const method = metadata[TOKEN_ENDPOINT_AUTH_METHOD]
  switch (method) {
    case 'none':
      if (metadata[TOKEN_ENDPOINT_AUTH_SIGNING_ALG]) {
        throw new TypeError(
          `${TOKEN_ENDPOINT_AUTH_SIGNING_ALG} must not be provided when ${TOKEN_ENDPOINT_AUTH_METHOD} is "${method}"`,
        )
      }
      break
    case 'private_key_jwt':
      if (!keyset) {
        throw new TypeError(
          `A keyset must be provided when ${TOKEN_ENDPOINT_AUTH_METHOD} is "${method}"`,
        )
      }
      if (!metadata.jwks_uri && !metadata.jwks?.keys.length) {
        throw new TypeError(
          `Client authentication method "${method}" requires a JWKS with at least one public key`,
        )
      }
      // Make sure all the signing keys that could end-up being used are
      // advertised in the JWKS.
      for (const { kid } of keyset.list({ use: 'sig' })) {
        // @NOTE we could rely on "jkt" (as that's what the server uses under
        // the hood) but for convenience (and because it is a good practice), we
        // require a "kid" on all singing public keys.
        if (!kid) {
          throw new TypeError(`The keyset contains a signing key with no "kid"`)
        }
        // @NOTE we only check for key defined in the client metadata document
        // itself, not for keys defined in the document located at "jwks_uri" as
        // we do not whish to download that file (for efficiency reasons).
        if (input.jwks && !input.jwks.keys.some((k) => k.kid === kid)) {
          throw new TypeError(`Key with kid "${kid}" not found in jwks`)
        }
      }
      if (!Array.from(keyset.list({ use: 'sig', alg: FALLBACK_ALG })).length) {
        throw new TypeError(
          `Client authentication method "${method}" requires at least one "${FALLBACK_ALG}" signing key with a "kid" property`,
        )
      }
      if (!metadata[TOKEN_ENDPOINT_AUTH_SIGNING_ALG]) {
        throw new TypeError(
          `${TOKEN_ENDPOINT_AUTH_SIGNING_ALG} must be provided when ${TOKEN_ENDPOINT_AUTH_METHOD} is "${method}"`,
        )
      }
      break
    default:
      throw new TypeError(
        `Invalid "${TOKEN_ENDPOINT_AUTH_METHOD}" value: ${method}`,
      )
  }

  return metadata
}
