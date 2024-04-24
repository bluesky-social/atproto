import {
  Did,
  DidDocument,
  DidError,
  DidService,
  extractDidMethod,
} from '@atproto/did'
import { FetchError } from '@atproto-labs/fetch'
import { ZodError } from 'zod'

import { DidMethod, DidMethods, ResolveOptions } from './did-method.js'

export type { DidMethod, ResolveOptions }
export type ResolvedDocument<D extends Did, M extends string = string> =
  D extends Did<infer N> ? DidDocument<N extends M ? N : never> : never

export type Filter =
  | { id?: string; type: string }
  | { id: string; type?: string }

export class DidResolverBase<M extends string = string> {
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

  async resolveService(
    did: Did,
    filter: Filter,
    options?: ResolveOptions,
  ): Promise<DidService> {
    if (!filter.id && !filter.type) {
      throw new TypeError(
        'Either "filter.id" or "filter.type" must be specified',
      )
    }
    const document = await this.resolve(did, options)
    const service = document.service?.find(
      (s) =>
        (!filter.id || s.id === filter.id) &&
        (!filter.type || s.type === filter.type),
    )
    if (service) return service

    throw new DidError(
      did,
      `No service matching "${filter.id || filter.type}" in DID Document`,
      'did-service-not-found',
      404,
    )
  }

  async resolveServiceEndpoint(
    did: Did,
    filter: Filter,
    options?: ResolveOptions,
  ): Promise<URL> {
    const service = await this.resolveService(did, filter, options)
    if (typeof service.serviceEndpoint === 'string') {
      return new URL(service.serviceEndpoint)
    } else if (Array.isArray(service.serviceEndpoint)) {
      // set of strings or maps
      if (service.serviceEndpoint.length === 1) {
        const first = service.serviceEndpoint[0]!
        if (typeof first === 'string') return new URL(first)
      }
    } else {
      // map
    }

    throw new DidError(
      did,
      `Unable to determine serviceEndpoint for "${filter.id || filter.type}"`,
      'did-service-endpoint-not-found',
      404,
    )
  }
}
