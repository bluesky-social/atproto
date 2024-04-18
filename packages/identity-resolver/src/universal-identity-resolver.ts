import {
  DidCache,
  IsomorphicDidResolver,
  IsomorphicDidResolverOptions,
} from '@atproto-labs/did'
import { Fetch } from '@atproto-labs/fetch'
import UniversalHandleResolver, {
  HandleResolverCache,
  UniversalHandleResolverOptions,
} from '@atproto-labs/handle-resolver'
import { IdentityResolver } from './identity-resolver.js'

export type { DidCache, DidDocument } from '@atproto-labs/did'
export type {
  HandleResolverCache,
  ResolvedHandle,
} from '@atproto-labs/handle-resolver'

export type UniversalIdentityResolverOptions = {
  fetch?: Fetch

  didCache?: DidCache
  handleCache?: HandleResolverCache

  /**
   * @see {@link IsomorphicDidResolverOptions.plcDirectoryUrl}
   */
  plcDirectoryUrl?: IsomorphicDidResolverOptions['plcDirectoryUrl']

  /**
   * @see {@link UniversalHandleResolverOptions.atprotoLexiconUrl}
   */
  atprotoLexiconUrl?: UniversalHandleResolverOptions['atprotoLexiconUrl']
}

export class UniversalIdentityResolver extends IdentityResolver {
  static from({
    fetch = globalThis.fetch,
    didCache,
    handleCache,
    plcDirectoryUrl,
    atprotoLexiconUrl,
  }: UniversalIdentityResolverOptions) {
    return new this(
      new UniversalHandleResolver({
        fetch,
        cache: handleCache,
        atprotoLexiconUrl,
      }),
      new IsomorphicDidResolver({
        fetch, //
        cache: didCache,
        plcDirectoryUrl,
      }),
    )
  }
}
