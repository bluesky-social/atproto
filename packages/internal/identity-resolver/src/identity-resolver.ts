import { normalizeAndEnsureValidHandle } from '@atproto/syntax'
import {
  Did,
  DidDocument,
  DidResolver,
  DidService,
  ResolveDidOptions,
} from '@atproto-labs/did-resolver'
import {
  AtprotoIdentityDidMethods,
  HandleResolver,
  ResolveHandleOptions,
  ResolvedHandle,
  isResolvedHandle,
} from '@atproto-labs/handle-resolver'

export type ResolvedIdentity = {
  did: NonNullable<ResolvedHandle>
  pds: URL
}

export type ResolveIdentityOptions = ResolveDidOptions & ResolveHandleOptions

export class IdentityResolver {
  constructor(
    readonly didResolver: DidResolver<AtprotoIdentityDidMethods>,
    readonly handleResolver: HandleResolver,
  ) {}

  public async resolve(
    input: string,
    options?: ResolveIdentityOptions,
  ): Promise<ResolvedIdentity> {
    const document = isResolvedHandle(input)
      ? await this.getDocumentFromDid(input, options)
      : await this.getDocumentFromHandle(input, options)

    const service = document.service?.find(
      isAtprotoPersonalDataServerService<AtprotoIdentityDidMethods>,
      document,
    )

    if (!service) {
      throw new TypeError(
        `No valid "AtprotoPersonalDataServer" service found in "${document.id}" DID document`,
      )
    }

    return {
      did: document.id,
      pds: new URL(service.serviceEndpoint),
    }
  }

  public async getDocumentFromDid(
    did: NonNullable<ResolvedHandle>,
    options?: ResolveDidOptions,
  ): Promise<DidDocument<AtprotoIdentityDidMethods>> {
    return this.didResolver.resolve(did, options)
  }

  public async getDocumentFromHandle(
    input: string,
    options?: ResolveHandleOptions,
  ): Promise<DidDocument<AtprotoIdentityDidMethods>> {
    const handle = normalizeAndEnsureValidHandle(input)

    const did = await this.handleResolver.resolve(handle, options)

    if (!did) {
      throw new TypeError(`Handle "${handle}" does not resolve to a DID`)
    }

    options?.signal?.throwIfAborted()

    // Note: Not using "return this.resolveDid(did, options)" to make the extra
    // check for the handle in the DID document:

    const document = await this.didResolver.resolve(did, options)

    // Ensure that the handle is included in the document
    if (!document.alsoKnownAs?.includes(`at://${handle}`)) {
      throw new TypeError(
        `Did document for "${did}" does not include the handle "${handle}"`,
      )
    }

    return document
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
    (s.id.startsWith('#')
      ? s.id === '#atproto_pds'
      : s.id === `${this.id}#atproto_pds`)
  )
}
