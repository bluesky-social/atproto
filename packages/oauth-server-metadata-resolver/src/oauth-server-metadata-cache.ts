import { GenericStore } from '@atproto/caching'
import { OAuthServerMetadata } from '@atproto/oauth-server-metadata'

export type OAuthServerMetadataCache = GenericStore<string, OAuthServerMetadata>
