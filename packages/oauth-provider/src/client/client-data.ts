import { Jwks } from '@atproto/jwk'

import { ClientMetadata } from './client-metadata.js'

export type ClientData = {
  metadata: ClientMetadata
  jwks?: Jwks
}
