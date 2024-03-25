import IsomorphicOAuthServerMetadataResolver, {
  OAuthServerMetadata,
  OAuthServerMetadataCache,
  OAuthServerMetadataResolver,
} from '@atproto/oauth-server-metadata-resolver'
import { IdentityResolver, IdentityResolverOptions } from './identity-resolver'

export type OAuthResolverOptions = IdentityResolverOptions & {
  serverMetadataCache?: OAuthServerMetadataCache
}

export class OAuthResolver {
  static from({
    fetch = globalThis.fetch,
    serverMetadataCache,
    ...identityResolverOptions
  }: OAuthResolverOptions) {
    return new OAuthResolver(
      new IsomorphicOAuthServerMetadataResolver({
        fetch,
        cache: serverMetadataCache,
      }),
      IdentityResolver.from({ fetch, ...identityResolverOptions }),
    )
  }

  constructor(
    readonly metadataResolver: OAuthServerMetadataResolver,
    readonly identityResolver: IdentityResolver,
  ) {}

  public async resolve(input: string): Promise<{
    did: string | null
    pds: URL
    metadata: OAuthServerMetadata
  }> {
    const { pds, did } = input.startsWith('https:')
      ? { pds: new URL(input), did: null }
      : await this.identityResolver.resolve(input)

    const metadata = await this.resolveOAuthMetadata(pds.origin)

    return { did, pds, metadata }
  }

  public async resolveOAuthMetadata(
    origin: string,
  ): Promise<OAuthServerMetadata> {
    return this.metadataResolver.resolve(origin)
  }
}
