import {
  ResolveIdentityOptions,
  IdentityResolver,
  ResolvedIdentity,
} from '@atproto-labs/identity-resolver'
import { OAuthAuthorizationServerMetadata } from '@atproto/oauth-types'

import { OAuthResolverError } from './oauth-resolver-error.js'
import {
  GetCachedOptions,
  OAuthAuthorizationServerMetadataResolver,
} from './oauth-authorization-server-metadata-resolver.js'
import { OAuthProtectedResourceMetadataResolver } from './oauth-protected-resource-metadata-resolver.js'

export type { GetCachedOptions }
export type ResolveOAuthOptions = GetCachedOptions & ResolveIdentityOptions

export class OAuthResolver {
  constructor(
    readonly identityResolver: IdentityResolver,
    readonly protectedResourceMetadataResolver: OAuthProtectedResourceMetadataResolver,
    readonly authorizationServerMetadataResolver: OAuthAuthorizationServerMetadataResolver,
  ) {}

  public async resolveIdentity(
    input: string,
    options?: ResolveIdentityOptions,
  ): Promise<ResolvedIdentity> {
    try {
      return await this.identityResolver.resolve(input, options)
    } catch (cause) {
      throw OAuthResolverError.from(
        cause,
        `Failed to resolve identity: ${input}`,
      )
    }
  }

  public async resolveMetadata(
    issuer: string,
    options?: GetCachedOptions,
  ): Promise<OAuthAuthorizationServerMetadata> {
    try {
      return await this.authorizationServerMetadataResolver.get(issuer, options)
    } catch (cause) {
      throw OAuthResolverError.from(
        cause,
        `Failed to resolve OAuth server metadata for issuer: ${issuer}`,
      )
    }
  }

  public async resolvePdsMetadata(
    pds: string | URL,
    options?: GetCachedOptions,
  ) {
    try {
      const rsMetadata = await this.protectedResourceMetadataResolver.get(
        pds,
        options,
      )

      const issuer = rsMetadata.authorization_servers?.[0]
      if (!issuer) {
        throw new OAuthResolverError(
          `No authorization servers found for PDS: ${pds}`,
        )
      }

      options?.signal?.throwIfAborted()

      const asMetadata = await this.resolveMetadata(issuer, options)

      // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05#section-4
      if (asMetadata.protected_resources) {
        if (!asMetadata.protected_resources.includes(rsMetadata.resource)) {
          throw new OAuthResolverError(
            `PDS "${pds}" not protected by issuer "${issuer}"`,
          )
        }
      }

      return asMetadata
    } catch (cause) {
      options?.signal?.throwIfAborted()

      throw OAuthResolverError.from(
        cause,
        `Failed to resolve OAuth server metadata for resource: ${pds}`,
      )
    }
  }

  public async resolve(
    input: string,
    options?: ResolveOAuthOptions,
  ): Promise<{
    identity: ResolvedIdentity
    metadata: OAuthAuthorizationServerMetadata
  }> {
    options?.signal?.throwIfAborted()

    const identity = await this.resolveIdentity(input, options)

    options?.signal?.throwIfAborted()

    const metadata = await this.resolvePdsMetadata(identity.pds, options)

    return { identity, metadata }
  }
}
