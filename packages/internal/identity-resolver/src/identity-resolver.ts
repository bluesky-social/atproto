import { isValidHandle, normalizeAndEnsureValidHandle } from '@atproto/syntax'
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
import { IdentityResolverError } from './identity-resolver-error'

export type ResolvedIdentity = {
  did: NonNullable<ResolvedHandle>
  pds: URL
  handle?: string
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
    const document = await this.getDocument(input, options)

    const service = document.service?.find(
      isAtprotoPersonalDataServerService<AtprotoIdentityDidMethods>,
      document,
    )

    if (!service) {
      throw new IdentityResolverError(
        `No valid "AtprotoPersonalDataServer" service found in "${document.id}" DID document`,
      )
    }

    return {
      did: document.id,
      pds: new URL(service.serviceEndpoint),
      handle: getValidHandle(document),
    }
  }

  public async getDocument(
    input: string,
    options?: ResolveIdentityOptions,
  ): Promise<DidDocument<AtprotoIdentityDidMethods>> {
    return isResolvedHandle(input)
      ? this.getDocumentFromDid(input, options)
      : this.getDocumentFromHandle(input, options)
  }

  public async getDocumentFromDid(
    did: NonNullable<ResolvedHandle>,
    options?: ResolveDidOptions,
  ): Promise<DidDocument<AtprotoIdentityDidMethods>> {
    const document = await this.didResolver.resolve(did, options)

    const handle = getValidHandle(document)
    if (handle) {
      options?.signal?.throwIfAborted()

      const did = await this.handleResolver.resolve(handle, options)
      if (did !== document.id) {
        throw new IdentityResolverError(
          `Did document for "${did}" does not match the handle "${handle}"`,
        )
      }
    }

    return document
  }

  public async getDocumentFromHandle(
    input: string,
    options?: ResolveHandleOptions,
  ): Promise<DidDocument<AtprotoIdentityDidMethods>> {
    const handle = normalizeAndEnsureValidHandle(input)

    const did = await this.handleResolver.resolve(handle, options)

    if (!did) {
      throw new IdentityResolverError(
        `Handle "${handle}" does not resolve to a DID`,
      )
    }

    options?.signal?.throwIfAborted()

    // Note: Not using "return this.resolveDid(did, options)" to make the extra
    // check for the handle in the DID document:

    const document = await this.didResolver.resolve(did, options)

    // Ensure that the handle is included in the document
    if (!document.alsoKnownAs?.includes(`at://${handle}`)) {
      throw new IdentityResolverError(
        `Did document for "${did}" does not include the handle "${handle}"`,
      )
    }

    return document
  }
}

// Same as getHandle from @atproto/common-web
function getHandle(
  document: DidDocument<AtprotoIdentityDidMethods>,
): string | undefined {
  if (document.alsoKnownAs) {
    for (const h of document.alsoKnownAs) {
      if (h.startsWith('at://')) {
        // strip off "at://" prefix
        return h.slice(5)
      }
    }
  }
  return undefined
}

function getValidHandle(
  document: DidDocument<AtprotoIdentityDidMethods>,
): string | undefined {
  const handle = getHandle(document)
  if (handle != null && !isValidHandle(handle)) {
    throw new IdentityResolverError(
      `Invalid handle "${handle}" in DID document "${document.id}"`,
    )
  }
  return undefined
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
