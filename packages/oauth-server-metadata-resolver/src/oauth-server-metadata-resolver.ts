import { GetOptions } from '@atproto/caching'
import { OAuthServerMetadata } from '@atproto/oauth-server-metadata'

export type ResolveOptions = GetOptions
export type { OAuthServerMetadata }

export interface OAuthServerMetadataResolver {
  resolve(
    origin: string,
    options?: ResolveOptions,
  ): Promise<OAuthServerMetadata>
}
