import type { Jwks } from '@atproto/jwk'
import type { OAuthClientMetadata } from '@atproto/oauth-types'

export type { OAuthClientMetadata }

export type ClientData = {
  metadata: OAuthClientMetadata
  jwks?: Jwks
}
