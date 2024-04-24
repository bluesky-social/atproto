import {
  DidResolver,
  ResolveOptions as DidResolveOptions,
} from '@atproto-labs/did-resolver'
import {
  HandleResolver,
  ResolveOptions as HandleResolveOptions,
  ResolvedHandle,
  isResolvedHandle,
} from '@atproto-labs/handle-resolver'
import { normalizeAndEnsureValidHandle } from '@atproto/syntax'

export type ResolvedIdentity = {
  did: NonNullable<ResolvedHandle>
  url: URL
}

export type ResolveOptions = DidResolveOptions & HandleResolveOptions

export class IdentityResolver {
  constructor(
    readonly handleResolver: HandleResolver,
    readonly didResolver: DidResolver,
  ) {}

  public async resolve(
    input: string,
    serviceType = 'AtprotoPersonalDataServer',
    options?: ResolveOptions,
  ): Promise<ResolvedIdentity> {
    const did = isResolvedHandle(input)
      ? input // Already a did
      : await this.handleResolver.resolve(
          normalizeAndEnsureValidHandle(input),
          options,
        )
    if (!did) throw new Error(`Handle ${input} does not resolve to a DID`)

    const url = await this.didResolver.resolveServiceEndpoint(
      did,
      { type: serviceType },
      options,
    )

    return { did, url }
  }
}
