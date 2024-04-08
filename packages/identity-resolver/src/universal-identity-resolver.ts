import {
  DidCache,
  IsomorphicDidResolver,
  IsomorphicDidResolverOptions,
} from '@atproto/did'
import { Fetch } from '@atproto/fetch'
import UniversalHandleResolver, {
  HandleResolverCache,
} from '@atproto/handle-resolver'
import { IdentityResolver } from './identity-resolver.js'

export type UniversalIdentityResolverOptions = {
  fetch?: Fetch

  didCache?: DidCache
  handleCache?: HandleResolverCache

  /**
   * @see {@link IsomorphicDidResolverOptions.plcDirectoryUrl}
   */
  plcDirectoryUrl?: IsomorphicDidResolverOptions['plcDirectoryUrl']
}

export class UniversalIdentityResolver extends IdentityResolver {
  static from({
    fetch = globalThis.fetch,
    didCache,
    handleCache,
    plcDirectoryUrl,
  }: UniversalIdentityResolverOptions) {
    return new this(
      new UniversalHandleResolver({
        fetch,
        cache: handleCache,
      }),
      new IsomorphicDidResolver({
        fetch, //
        cache: didCache,
        plcDirectoryUrl,
      }),
    )
  }
}
