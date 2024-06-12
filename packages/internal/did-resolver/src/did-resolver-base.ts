import { FetchRequestError } from '@atproto-labs/fetch'
import { Did, DidError, extractDidMethod } from '@atproto/did'
import { ZodError } from 'zod'

import { DidMethod, DidMethods, ResolveOptions } from './did-method.js'
import { DidResolver, ResolvedDocument } from './did-resolver.js'

export type { DidMethod, ResolveOptions, ResolvedDocument }

export class DidResolverBase<M extends string = string>
  implements DidResolver<M>
{
  protected readonly methods: Map<string, DidMethod<M>>

  constructor(methods: DidMethods<M>) {
    this.methods = new Map(Object.entries(methods))
  }

  async resolve<D extends Did>(
    did: D,
    options?: ResolveOptions,
  ): Promise<ResolvedDocument<D, M>> {
    options?.signal?.throwIfAborted()

    const method = extractDidMethod(did)
    const resolver = this.methods.get(method)
    if (!resolver) {
      throw new DidError(
        did,
        `Unsupported DID method`,
        'did-method-invalid',
        400,
      )
    }

    try {
      const document = await resolver.resolve(did as Did<M>, options)
      if (document.id !== did) {
        throw new DidError(
          did,
          `DID document id (${document.id}) does not match DID`,
          'did-document-id-mismatch',
          400,
        )
      }

      return document as ResolvedDocument<D, M>
    } catch (err) {
      if (err instanceof FetchRequestError) {
        throw new DidError(did, err.message, 'did-fetch-error', 400, err)
      }

      if (err instanceof ZodError) {
        throw new DidError(
          did,
          err.message,
          'did-document-format-error',
          503,
          err,
        )
      }

      throw DidError.from(err, did)
    }
  }
}
