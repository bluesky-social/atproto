import { Keyset } from '@atproto/jwk'
import { OAuthClientMetadataInput } from '@atproto/oauth-types'

import { ClientMetadata, clientMetadataSchema } from './types.js'

const TOKEN_ENDPOINT_AUTH_METHOD = `token_endpoint_auth_method`
const TOKEN_ENDPOINT_AUTH_SIGNING_ALG = `token_endpoint_auth_signing_alg`

export function validateClientMetadata(
  input: OAuthClientMetadataInput,
  keyset?: Keyset,
): ClientMetadata {
  if (input.jwks) {
    if (!keyset) {
      throw new TypeError(`Keyset must not be provided when jwks is provided`)
    }
    for (const key of input.jwks.keys) {
      if (!key.kid) {
        throw new TypeError(`Key must have a "kid" property`)
      } else if (!keyset.has(key.kid)) {
        throw new TypeError(`Key with kid "${key.kid}" not found in keyset`)
      }
    }
  }

  // Allow to pass a keyset and omit the jwks/jwks_uri properties
  if (!input.jwks && !input.jwks_uri && keyset?.size) {
    input = { ...input, jwks: keyset.toJSON() }
  }

  const metadata = clientMetadataSchema.parse(input)

  // ATPROTO uses client metadata discovery
  try {
    new URL(metadata.client_id)
  } catch (cause) {
    throw new TypeError(`client_id must be a valid URL`, { cause })
  }

  const method = metadata[TOKEN_ENDPOINT_AUTH_METHOD]
  switch (method) {
    case undefined:
      throw new TypeError(`${TOKEN_ENDPOINT_AUTH_METHOD} must be provided`)
    case 'none':
      if (metadata[TOKEN_ENDPOINT_AUTH_SIGNING_ALG]) {
        throw new TypeError(
          `${TOKEN_ENDPOINT_AUTH_SIGNING_ALG} must not be provided when ${TOKEN_ENDPOINT_AUTH_METHOD} is "${method}"`,
        )
      }
      break
    case 'private_key_jwt':
      if (!keyset?.size) {
        throw new TypeError(
          `A non-empty keyset must be provided when ${TOKEN_ENDPOINT_AUTH_METHOD} is "${method}"`,
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
        `Invalid "token_endpoint_auth_method" value: ${method}`,
      )
  }

  return metadata
}
