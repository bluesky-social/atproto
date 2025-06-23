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
import { HANDLE_INVALID } from './constants.js'
import { IdentityResolverError } from './identity-resolver-error.js'
import {
  IdentityInfo,
  IdentityResolver,
  ResolveIdentityOptions,
} from './identity-resolver.js'
import { asNormalizedHandle, extractNormalizedHandle } from './util.js'

// @TODO Move this to its own package as soon as we have a distinct
// implementation based on XRPC calls to the
// "com.atproto.identity.resolveIdentity" method.

/**
 * Implementation of the official ATPROTO identity resolution strategy.
 * This implementation relies on two primitives:
 * - DID resolution (using the `DidResolver` interface)
 * - Handle resolution (using the `HandleResolver` interface)
 */
export class AtprotoIdentityResolver implements IdentityResolver {
  constructor(
    protected readonly didResolver: DidResolver<AtprotoIdentityDidMethods>,
    protected readonly handleResolver: HandleResolver,
  ) {}

  public async resolve(
    input: string,
    options?: ResolveIdentityOptions,
  ): Promise<IdentityInfo> {
    return isAtprotoDid(input)
      ? this.resolveFromDid(input, options)
      : this.resolveFromHandle(input, options)
  }

  public async resolveFromDid(
    did: AtprotoDid,
    options?: ResolveDidOptions,
  ): Promise<IdentityInfo> {
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
      did: document.id,
      didDoc: document,
      handle: handle && resolvedDid === did ? handle : HANDLE_INVALID,
    }
  }

  public async resolveFromHandle(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<IdentityInfo> {
    const document = await this.getDocumentFromHandle(handle, options)

    // @NOTE bi-directional resolution enforced in getDocumentFromHandle()

    return {
      did: document.id,
      didDoc: document,
      handle: extractNormalizedHandle(document) || HANDLE_INVALID,
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
