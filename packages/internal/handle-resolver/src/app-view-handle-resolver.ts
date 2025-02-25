import { z } from 'zod'
import {
  HandleResolver,
  ResolveHandleOptions,
  ResolvedHandle,
  isResolvedHandle,
} from './types.js'

export const xrpcErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

export type AppViewHandleResolverOptions = {
  /**
   * Fetch function to use for HTTP requests. Allows customizing the request
   * behavior, e.g. adding headers, setting a timeout, mocking, etc.
   *
   * @default globalThis.fetch
   */
  fetch?: typeof globalThis.fetch
}

export class AppViewHandleResolver implements HandleResolver {
  static from(
    service: URL | string | HandleResolver,
    options?: AppViewHandleResolverOptions,
  ): HandleResolver {
    if (typeof service === 'string' || service instanceof URL) {
      return new AppViewHandleResolver(service, options)
    }
    return service
  }

  /**
   * URL of the atproto lexicon server. This is the base URL where the
   * `com.atproto.identity.resolveHandle` XRPC method is located.
   */
  protected readonly serviceUrl: URL
  protected readonly fetch: typeof globalThis.fetch

  constructor(service: URL | string, options?: AppViewHandleResolverOptions) {
    this.serviceUrl = new URL(service)
    this.fetch = options?.fetch ?? globalThis.fetch
  }

  public async resolve(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle> {
    const url = new URL(
      '/xrpc/com.atproto.identity.resolveHandle',
      this.serviceUrl,
    )
    url.searchParams.set('handle', handle)

    const response = await this.fetch.call(null, url, {
      cache: options?.noCache ? 'no-cache' : undefined,
      signal: options?.signal,
      redirect: 'error',
    })
    const payload = await response.json()

    // The response should either be
    // - 400 Bad Request with { error: 'InvalidRequest', message: 'Unable to resolve handle' }
    // - 200 OK with { did: NonNullable<ResolvedHandle> }
    // Any other response is considered unexpected behavior an should throw an error.

    if (response.status === 400) {
      const data = xrpcErrorSchema.parse(payload)
      if (
        data.error === 'InvalidRequest' &&
        data.message === 'Unable to resolve handle'
      ) {
        return null
      }
    }

    if (!response.ok) {
      throw new TypeError('Invalid response from resolveHandle method')
    }

    const value: unknown = payload?.did

    if (!isResolvedHandle(value)) {
      throw new TypeError('Invalid DID returned from resolveHandle method')
    }

    return value
  }
}
