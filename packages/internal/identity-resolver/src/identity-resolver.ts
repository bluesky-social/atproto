import {
  Did,
  DidDocument,
  ResolveOptions as DidResolveOptions,
  DidResolver,
  DidService,
} from '@atproto-labs/did-resolver'
import {
  ResolveOptions as HandleResolveOptions,
  HandleResolver,
  ResolvedHandle,
  isResolvedHandle,
} from '@atproto-labs/handle-resolver'
import { normalizeAndEnsureValidHandle } from '@atproto/syntax'

export type ResolvedIdentity = {
  did: NonNullable<ResolvedHandle>
  pds: URL
}

export type ResolveOptions = DidResolveOptions & HandleResolveOptions

export class IdentityResolver {
  constructor(
    readonly didResolver: DidResolver<'plc' | 'web'>,
    readonly handleResolver: HandleResolver,
  ) {}

  public async resolve(
    input: string,
    options?: ResolveOptions,
  ): Promise<ResolvedIdentity> {
    const did = isResolvedHandle(input)
      ? input // Already a did
      : await this.handleResolver.resolve(
          normalizeAndEnsureValidHandle(input),
          options,
        )

    options?.signal?.throwIfAborted()

    if (!did) {
      throw new TypeError(`Handle "${input}" does not resolve to a DID`)
    }

    const document = await this.didResolver.resolve(did, options)

    const service = document.service?.find(
      isAtprotoPersonalDataServerService<'plc' | 'web'>,
      document,
    )

    if (!service) {
      throw new TypeError(
        `No valid "AtprotoPersonalDataServer" service found in "${did}" DID document`,
      )
    }

    const pds = new URL(service.serviceEndpoint)

    return { did, pds }
  }
}

function isAtprotoPersonalDataServerService<M extends string>(
  this: DidDocument<M>,
  s: DidService,
): s is {
  id: '#atproto_pds' | `${Did<M>}#atproto_pds`
  type: 'AtprotoPersonalDataServer'
  serviceEndpoint: string
} {
  return (
    typeof s.serviceEndpoint === 'string' &&
    s.type === 'AtprotoPersonalDataServer' &&
    (s.id === '#atproto_pds' || s.id === `${this.id}#atproto_pds`)
  )
}
