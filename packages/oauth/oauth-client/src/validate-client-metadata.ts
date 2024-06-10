import { Keyset } from '@atproto/jwk'
import { OAuthClientMetadataInput } from '@atproto/oauth-types'

import { ClientMetadata, clientMetadataSchema } from './types.js'

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

  for (const endpoint of [
    'token',
    'revocation',
    'introspection',
    'pushed_authorization_request',
  ] as const) {
    const method = metadata[`${endpoint}_endpoint_auth_method`]
    if (method && method !== 'none') {
      if (!keyset) {
        throw new TypeError(`Keyset is required for ${method} method`)
      }
      if (!metadata[`${endpoint}_endpoint_auth_signing_alg`]) {
        throw new TypeError(
          `${endpoint}_endpoint_auth_signing_alg must be provided`,
        )
      }
    }
  }

  return metadata
}
