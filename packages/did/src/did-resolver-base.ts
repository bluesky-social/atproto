import { FetchError } from '@atproto/fetch'
import { ZodError } from 'zod'

import { DidDocument, DidService } from './did-document.js'
import {
  DidDocumentFormatError,
  DidError,
  DidResolutionError,
} from './did-error.js'
import { DidMethod, DidMethods, ResolveOptions } from './did-method.js'
import { Did, extractDidMethod } from './did.js'

export type { DidMethod, ResolveOptions }
export type ResolvedDocument<D extends Did, M extends string = string> =
  D extends Did<infer N> ? DidDocument<N extends M ? N : never> : never

export class DidResolverBase<M extends string = string> {
  protected readonly methods: Map<string, DidMethod<M>>

  constructor(methods: DidMethods<M>) {
    this.methods = new Map(Object.entries(methods))
  }

  async resolve<D extends Did>(
    did: D,
    options?: ResolveOptions,
  ): Promise<ResolvedDocument<D, M>> {
    const method = extractDidMethod(did)
    const resolver = this.methods.get(method)
    if (!resolver) {
      throw new DidResolutionError(
        did,
        `Unsupported DID method`,
        'did-method-invalid',
        400,
      )
    }

    try {
      const document = await resolver.resolve(did as Did<M>, options)
      if (document.id !== did) {
        throw new DidDocumentFormatError(
          did,
          `DID document id (${document.id}) does not match DID`,
        )
      }

      return document as ResolvedDocument<D, M>
    } catch (err) {
      if (err instanceof FetchError) {
        throw DidResolutionError.fromHttpError(err, did)
      }
      if (err instanceof ZodError) {
        throw DidDocumentFormatError.fromValidationError(err, did)
      }
      throw DidError.from(err, did)
    }
  }

  async resolveService(
    did: Did,
    filter: { id?: string; type?: string },
    options?: ResolveOptions,
  ): Promise<DidService> {
    if (!filter.id && !filter.type) {
      throw new DidResolutionError(
        did,
        'Either "filter.id" or "filter.type" must be specified',
        'did-service-filter-invalid',
      )
    }
    const document = await this.resolve(did, options)
    const service = document.service?.find(
      (s) =>
        (!filter.id || s.id === filter.id) &&
        (!filter.type || s.type === filter.type),
    )
    if (service) return service

    throw new DidDocumentFormatError(
      did,
      `No service matching "${filter.id || filter.type}" in DID Document`,
      'did-service-not-found',
      404,
    )
  }

  async resolveServiceEndpoint(
    did: Did,
    filter: { id?: string; type?: string },
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

    throw new DidDocumentFormatError(
      did,
      `Unable to determine serviceEndpoint for "${filter.id || filter.type}"`,
      'did-service-endpoint-not-found',
      404,
    )
  }
}
