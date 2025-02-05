import { ZodError } from 'zod'
import { Did, DidError, extractDidMethod } from '@atproto/did'
import { FetchError, FetchResponseError } from '@atproto-labs/fetch'
import { DidMethod, DidMethods, ResolveDidOptions } from './did-method.js'
import { DidResolver, ResolvedDocument } from './did-resolver.js'

export type { DidMethod, ResolveDidOptions, ResolvedDocument }

export class DidResolverBase<M extends string = string>
  implements DidResolver<M>
{
  protected readonly methods: Map<string, DidMethod<M>>

  constructor(methods: DidMethods<M>) {
    this.methods = new Map(Object.entries(methods))
  }

  async resolve<D extends Did>(
    did: D,
    options?: ResolveDidOptions,
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
      if (err instanceof FetchResponseError) {
        const status = err.response.status >= 500 ? 502 : err.response.status
        throw new DidError(did, err.message, 'did-fetch-error', status, err)
      }

      if (err instanceof FetchError) {
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
