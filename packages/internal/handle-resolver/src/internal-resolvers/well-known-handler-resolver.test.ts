import { describe, expect, it } from 'vitest'
import { WellKnownHandleResolver } from './well-known-handler-resolver.js'

const DID = 'did:plc:abcdefghijklmnopqrstuvwx'

const fetchReturning = (body: string, init?: ResponseInit) =>
  (async () => new Response(body, init)) as unknown as typeof globalThis.fetch

const fetchRejecting = (err: unknown) =>
  (async () => {
    throw err
  }) as unknown as typeof globalThis.fetch

describe(WellKnownHandleResolver, () => {
  it('resolves a handle from the well-known endpoint', async () => {
    const resolver = new WellKnownHandleResolver({ fetch: fetchReturning(DID) })
    await expect(resolver.resolve('alice.test')).resolves.toBe(DID)
  })

  it('returns null when the body is not a valid DID', async () => {
    const resolver = new WellKnownHandleResolver({
      fetch: fetchReturning('not-a-did'),
    })
    await expect(resolver.resolve('alice.test')).resolves.toBeNull()
  })

  it('returns null on genuine network failures (TypeError)', async () => {
    // The WHATWG fetch standard rejects with a `TypeError` for unreachable
    // hosts, connection refused, blocked redirects, etc. Those mean the handle
    // simply does not resolve.
    const resolver = new WellKnownHandleResolver({
      fetch: fetchRejecting(new TypeError('fetch failed')),
    })
    await expect(resolver.resolve('alice.test')).resolves.toBeNull()
  })

  it('re-throws unexpected errors instead of swallowing them', async () => {
    // Regression test for #4215: the SSRF/unicast protection added by
    // `safeFetchWrap` throws *before* any network exchange when a handle
    // resolves to a non-unicast address (e.g. 127.0.0.1). That error must
    // bubble up so the caller understands *why* resolution failed, rather than
    // being silently turned into `null`.
    class FetchRequestError extends Error {
      constructor(
        public readonly statusCode: number,
        message: string,
      ) {
        super(message)
        this.name = 'FetchRequestError'
      }
    }
    const ssrfError = new FetchRequestError(
      400,
      'Hostname is a non-unicast address',
    )
    const resolver = new WellKnownHandleResolver({
      fetch: fetchRejecting(ssrfError),
    })
    await expect(resolver.resolve('handle.princess.works')).rejects.toBe(
      ssrfError,
    )
  })

  it('propagates an abort error', async () => {
    const controller = new AbortController()
    controller.abort()
    const resolver = new WellKnownHandleResolver({
      fetch: fetchRejecting(new TypeError('aborted')),
    })
    await expect(
      resolver.resolve('alice.test', { signal: controller.signal }),
    ).rejects.toThrow()
  })
})
