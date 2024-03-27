import { Jwks } from '@atproto/jwk'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'

export type ClientData = {
  metadata: OAuthClientMetadata
  jwks?: Jwks
}
