import { isDid } from '@atproto/did'
import { Fetch } from '@atproto/fetch'
import z from 'zod'

import {
  HandleResolveOptions,
  HandleResolveValue,
  HandleResolver,
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
  ): Promise<HandleResolveValue> {
    const url = new URL('/xrpc/com.atproto.identity.resolveHandle', this.url)
    url.searchParams.set('handle', handle)

    const headers = new Headers()
    if (options?.noCache) headers.set('cache-control', 'no-cache')

    const request = new Request(url, { headers, signal: options?.signal })

    const response = await this.fetch.call(null, request)
    const payload = await response.json()

    if (response.status === 404) return null
    if (response.status === 400) {
      const response = xrpcErrorSchema.safeParse(payload)
      if (
        response.success &&
        response.data.error === 'InvalidRequest' &&
        response.data.message === 'Unable to resolve handle'
      ) {
        return null
      }
    }

    if (!response.ok) throw new Error('Failed to resolve handle')

    const did = payload?.did

    if (typeof did !== 'string' || !isDid(did, ['plc', 'web'])) {
      throw new Error('Invalid DID returned from xrpc')
    }

    return did
  }
}
