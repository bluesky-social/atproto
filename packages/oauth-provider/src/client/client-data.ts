import { Jwks } from '@atproto/jwk'
import { OAuthClientMetadata } from '@atproto/oauth-types'

export type ClientData = {
  metadata: OAuthClientMetadata
  jwks?: Jwks
}
