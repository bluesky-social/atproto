import { GetOptions } from '@atproto-labs/caching'
import { OAuthServerMetadata } from '@atproto-labs/oauth-server-metadata'

export type ResolveOptions = GetOptions
export type { OAuthServerMetadata }

export interface OAuthServerMetadataResolver {
  resolve(
    origin: string,
    options?: ResolveOptions,
  ): Promise<OAuthServerMetadata>
}
