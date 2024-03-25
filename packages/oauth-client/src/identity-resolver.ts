import {
  DidCache,
  DidResolver,
  IsomorphicDidResolver,
  isDid,
} from '@atproto/did'
import { Fetch } from '@atproto/fetch'
import IsomorphicHandleResolver, {
  HandleResolver,
  HandleResolverCache,
} from '@atproto/handle-resolver'

export type IdentityResolverOptions = {
  fetch?: Fetch
  didCache?: DidCache
  handleCache?: HandleResolverCache
}

export class IdentityResolver {
  static from({
    fetch = globalThis.fetch,
    didCache,
    handleCache,
  }: IdentityResolverOptions) {
    return new IdentityResolver(
      new IsomorphicHandleResolver({ fetch, cache: handleCache }),
      new IsomorphicDidResolver({ fetch, cache: didCache }),
    )
  }

  constructor(
    readonly handleResolver: HandleResolver,
    readonly didResolver: DidResolver<'plc' | 'web'>,
  ) {}

  public async resolve(input: string): Promise<{
    pds: URL
    did: string
  }> {
    if (isDid(input)) {
      if (!isDid(input, ['plc', 'web'])) {
        throw new TypeError(`Unsupported DID method ${input.split(':')[1]}`)
      }
      const pds = await this.didResolver.resolveServiceEndpoint(input, {
        type: 'AtprotoPersonalDataServer',
      })
      return { did: input, pds }
    }

    // TODO: Check if is a properly formatted handle?
    if (input.length && !input.includes(':') && !input.includes('/')) {
      const did = await this.handleResolver.resolve(input)
      if (!did) throw new Error(`Handle ${input} does not resolve to a DID`)
      const pds = await this.didResolver.resolveServiceEndpoint(did, {
        type: 'AtprotoPersonalDataServer',
      })
      return { did, pds }
    }

    throw new TypeError(`Invalid identity identifier "${input}"`)
  }
}
