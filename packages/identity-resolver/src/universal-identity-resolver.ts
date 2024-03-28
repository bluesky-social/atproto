import { DidCache, IsomorphicDidResolver } from '@atproto/did'
import { Fetch } from '@atproto/fetch'
import UniversalHandleResolver, {
  HandleResolverCache,
} from '@atproto/handle-resolver'
import { IdentityResolver } from './identity-resolver.js'

export type UniversalIdentityResolverOptions = {
  fetch?: Fetch

  didCache?: DidCache
  handleCache?: HandleResolverCache
}

export class UniversalIdentityResolver extends IdentityResolver {
  static from({
    fetch = globalThis.fetch,
    didCache,
    handleCache,
  }: UniversalIdentityResolverOptions) {
    return new this(
      new UniversalHandleResolver({
        fetch,
        cache: handleCache,
      }),
      new IsomorphicDidResolver({
        fetch, //
        cache: didCache,
      }),
    )
  }
}
