import {
  AtprotoDid,
  AtprotoIdentityDidMethods,
  DidDocument,
  DidResolver,
  ResolveDidOptions,
  isAtprotoDid,
} from '@atproto-labs/did-resolver'
import {
  HandleResolver,
  ResolveHandleOptions,
} from '@atproto-labs/handle-resolver'
import { IdentityResolverError } from './identity-resolver-error'
import { asNormalizedHandle, extractNormalizedHandle } from './util'

export type ResolvedIdentity = {
  document: DidDocument<AtprotoIdentityDidMethods>

  /**
   * Will be defined if the document contains a handle alias that resolves
   * to the document's DID.
   */
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
    return isAtprotoDid(input)
      ? this.resolveFromDid(input, options)
      : this.resolveFromHandle(input, options)
  }

  public async resolveFromDid(
    did: AtprotoDid,
    options?: ResolveDidOptions,
  ): Promise<ResolvedIdentity> {
    const document = await this.getDocumentFromDid(did, options)

    options?.signal?.throwIfAborted()

    // We will only return the document's handle alias if it resolves to the
    // same DID as the input.
    const handle = extractNormalizedHandle(document)
    const resolvedDid = handle
      ? await this.handleResolver
          .resolve(handle, options)
          .catch(() => undefined) // Ignore errors (temporarily unavailable)
      : undefined

    return {
      document,
      handle: resolvedDid === did ? handle : undefined,
    }
  }

  public async resolveFromHandle(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedIdentity> {
    const document = await this.getDocumentFromHandle(handle, options)

    // @NOTE bi-directional resolution enforced in getDocumentFromHandle()

    return {
      document,
      handle: extractNormalizedHandle(document),
    }
  }

  public async getDocumentFromDid(
    did: AtprotoDid,
    options?: ResolveDidOptions,
  ): Promise<DidDocument<AtprotoIdentityDidMethods>> {
    return this.didResolver.resolve(did, options)
  }

  public async getDocumentFromHandle(
    input: string,
    options?: ResolveHandleOptions,
  ): Promise<DidDocument<AtprotoIdentityDidMethods>> {
    const handle = asNormalizedHandle(input)
    if (!handle) {
      throw new IdentityResolverError(`Invalid handle "${input}" provided.`)
    }

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

    // Enforce bi-directional resolution
    if (handle !== extractNormalizedHandle(document)) {
      throw new IdentityResolverError(
        `Did document for "${did}" does not include the handle "${handle}"`,
      )
    }

    return document
  }
}
