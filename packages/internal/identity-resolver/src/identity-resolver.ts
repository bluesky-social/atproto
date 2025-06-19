import { isValidHandle, normalizeAndEnsureValidHandle } from '@atproto/syntax'
import {
  AtprotoIdentityDidMethods,
  DidDocument,
  DidResolver,
  ResolveDidOptions,
} from '@atproto-labs/did-resolver'
import {
  HandleResolver,
  ResolveHandleOptions,
  ResolvedHandle,
  isResolvedHandle,
} from '@atproto-labs/handle-resolver'
import { IdentityResolverError } from './identity-resolver-error'

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
    if (isResolvedHandle(input)) {
      const document = await this.getDocumentFromDid(input, options)

      options?.signal?.throwIfAborted()

      // If the input was a DID, we will only return the document's handle alias
      // if it resolves to the same DID as the input.
      const documentHandle = getHandle(document)
      const resolvedDid =
        documentHandle && isValidHandle(documentHandle)
          ? await this.handleResolver
              .resolve(documentHandle, options)
              .catch(() => undefined)
          : undefined

      return {
        document,
        handle: resolvedDid === document.id ? documentHandle : undefined,
      }
    } else {
      const document = await this.getDocumentFromHandle(input, options)

      // @NOTE bi-directional resolution is enforced in
      // getDocumentFromHandle, so we can safely assume that the document's
      // handle resolves to the same DID as the input.

      return {
        document,
        handle: getHandle(document),
      }
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
      throw new IdentityResolverError(
        `Handle "${handle}" does not resolve to a DID`,
      )
    }

    options?.signal?.throwIfAborted()

    // Note: Not using "return this.resolveDid(did, options)" to make the extra
    // check for the handle in the DID document:

    const document = await this.didResolver.resolve(did, options)

    // Enforce bi-directional resolution
    if (handle !== getHandle(document)) {
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
