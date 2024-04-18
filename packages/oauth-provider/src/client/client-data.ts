import { Jwks } from '@atproto-labs/jwk'
import { OAuthClientMetadata } from '@atproto-labs/oauth-client-metadata'

export type ClientData = {
  metadata: OAuthClientMetadata
  jwks?: Jwks
}
