import { Keyset } from '@atproto/jwk'
import {
  OAUTH_AUTHENTICATED_ENDPOINT_NAMES,
  OAuthClientMetadataInput,
} from '@atproto/oauth-types'

import { ClientMetadata, clientMetadataSchema } from './types.js'

// Improve bundle size by using concatenation
const _ENDPOINT_AUTH_METHOD = '_endpoint_auth_method'
const _ENDPOINT_AUTH_SIGNING_ALG = '_endpoint_auth_signing_alg'

const TOKEN_ENDPOINT_AUTH_METHOD = `token${_ENDPOINT_AUTH_METHOD}`

export function validateClientMetadata(
  input: OAuthClientMetadataInput,
  keyset?: Keyset,
): ClientMetadata {
  const metadata = clientMetadataSchema.parse(input)

  // ATPROTO uses client metadata discovery
  try {
    new URL(metadata.client_id)
  } catch (cause) {
    throw new TypeError(`client_id must be a valid URL`, { cause })
  }

  if (!metadata[TOKEN_ENDPOINT_AUTH_METHOD]) {
    throw new TypeError(`${TOKEN_ENDPOINT_AUTH_METHOD} must be provided`)
  }

  for (const endpointName of OAUTH_AUTHENTICATED_ENDPOINT_NAMES) {
    const method = metadata[`${endpointName}${_ENDPOINT_AUTH_METHOD}`]
    switch (method) {
      case undefined:
      case 'none':
        if (metadata[`${endpointName}${_ENDPOINT_AUTH_SIGNING_ALG}`]) {
          throw new TypeError(
            `${endpointName}${_ENDPOINT_AUTH_SIGNING_ALG} must not be provided`,
          )
        }
        break
      case 'client_secret_jwt':
        if (!keyset) {
          throw new TypeError(`Keyset is required for ${method} method`)
        }
        if (!metadata[`${endpointName}${_ENDPOINT_AUTH_SIGNING_ALG}`]) {
          throw new TypeError(
            `${endpointName}${_ENDPOINT_AUTH_SIGNING_ALG} must be provided`,
          )
        }
        break
      default:
        throw new TypeError(
          `Invalid "${endpointName}${_ENDPOINT_AUTH_METHOD}" value: ${method}`,
        )
    }
  }

  return metadata
}
