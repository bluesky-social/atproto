import { Fetch } from '@atproto/fetch'
import z from 'zod'

import {
  HandleResolveOptions,
  HandleResolver,
  ResolvedHandle,
  isResolvedHandle,
} from './handle-resolver.js'

export const xrpcErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

export type PublicXrpcHandleResolverOptions = {
  url?: URL | string
  fetch?: Fetch
}

export class PublicXrpcHandleResolver implements HandleResolver {
  protected readonly url: URL
  protected readonly fetch: Fetch

  constructor({
    url = new URL('https://bsky.social'),
    fetch = globalThis.fetch,
  }: PublicXrpcHandleResolverOptions = {}) {
    this.url = new URL(url)
    this.fetch = fetch
  }

  public async resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<ResolvedHandle> {
    const url = new URL('/xrpc/com.atproto.identity.resolveHandle', this.url)
    url.searchParams.set('handle', handle)

    const headers = new Headers()
    if (options?.noCache) headers.set('cache-control', 'no-cache')

    const request = new Request(url, { headers, signal: options?.signal })

    const response = await this.fetch.call(null, request)
    const payload = await response.json()

    // The response should either be
    // - 400 Bad Request with { error: 'InvalidRequest', message: 'Unable to resolve handle' }
    // - 200 OK with { did: string }
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
      throw new Error('Invalid response from resolveHandle method')
    }

    const value: unknown = payload?.did

    if (!value || !isResolvedHandle(value)) {
      throw new Error('Invalid DID returned from resolveHandle method')
    }

    return value
  }
}
