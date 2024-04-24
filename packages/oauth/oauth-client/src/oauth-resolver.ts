import {
  ResolveOptions as IdentityResolveOptions,
  IdentityResolver,
  ResolvedIdentity,
} from '@atproto-labs/identity-resolver'
import { OAuthServerMetadata } from '@atproto/oauth-types'

import { OAuthResolverError } from './oauth-resolver-error.js'
import {
  MetadataResolveOptions,
  OAuthServerMetadataResolver,
} from './oauth-server-metadata-resolver.js'

export type ResolveOptions = MetadataResolveOptions & IdentityResolveOptions

// try/catch to support running in a browser, including when process.env is
// shimmed (e.g. by webpack)
const ALLOW_UNSECURE = (() => {
  try {
    return process.env.NODE_ENV === 'development'
  } catch {
    return false
  }
})()

export class OAuthResolver {
  constructor(
    readonly identityResolver: IdentityResolver,
    readonly metadataResolver: OAuthServerMetadataResolver,
  ) {}

  public async resolveIdentity(
    input: string,
    options?: IdentityResolveOptions,
  ): Promise<ResolvedIdentity> {
    return this.identityResolver.resolve(
      input,
      'AtprotoPersonalDataServer',
      options,
    )
  }

  public async resolveMetadata(
    issuer: string | URL,
    options?: MetadataResolveOptions,
  ) {
    const { origin } = typeof issuer === 'string' ? new URL(issuer) : issuer
    return this.metadataResolver.resolve(origin, options)
  }

  public async resolve(
    input: string,
    options?: ResolveOptions,
  ): Promise<
    Partial<ResolvedIdentity> & {
      url: URL
      metadata: OAuthServerMetadata
    }
  > {
    // Allow using a PDS url directly as login input (e.g. when the handle does not resolve to a DID)
    const identity = /^https?:\/\//.test(input)
      ? { url: new URL(input) }
      : await this.resolveIdentity(input, options)

    if (!ALLOW_UNSECURE && identity.url.protocol !== 'https:') {
      throw new OAuthResolverError('Unsecure connections are not allowed')
    }

    const metadata = await this.resolveMetadata(identity.url, options)

    return { ...identity, metadata }
  }
}
