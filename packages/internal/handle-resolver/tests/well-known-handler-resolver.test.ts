import { describe, expect, it, vi } from 'vitest'
import { AtprotoHandleResolver, isResolvedHandle } from '../src/index.js'
import { WellKnownHandleResolver } from '../src/internal-resolvers/well-known-handler-resolver.js'

const DID = 'did:web:example.com'

function fetchReturning(resp: () => Response): typeof globalThis.fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    return resp()
  }) as unknown as typeof globalThis.fetch
}

function fetchThrowing(err: unknown): typeof globalThis.fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    throw err
  }) as unknown as typeof globalThis.fetch
}

describe('handle-resolver onError observability (#4215)', () => {
  it('sanity: sample DID is a valid atproto DID', () => {
    expect(isResolvedHandle(DID)).toBe(true)
  })

  describe('WellKnownHandleResolver', () => {
    it('200 + valid DID resolves and does not fire onError', async () => {
      const onError = vi.fn()
      const resolver = new WellKnownHandleResolver({
        fetch: fetchReturning(() => new Response(`${DID}\n`)),
        onError,
      })
      const result = await resolver.resolve('alice.test')
      expect(result).toBe(DID)
      expect(onError).not.toHaveBeenCalled()
    })

    it('200 + non-DID body returns null and does not fire onError', async () => {
      const onError = vi.fn()
      const resolver = new WellKnownHandleResolver({
        fetch: fetchReturning(() => new Response('not-a-did')),
        onError,
      })
      const result = await resolver.resolve('alice.test')
      expect(result).toBeNull()
      expect(onError).not.toHaveBeenCalled()
    })

    it('non-2xx returns null and fires onError once with well-known context', async () => {
      const onError = vi.fn()
      const resolver = new WellKnownHandleResolver({
        fetch: fetchReturning(
          () => new Response('Internal Server Error', { status: 500 }),
        ),
        onError,
      })
      const result = await resolver.resolve('alice.test')
      expect(result).toBeNull()
      expect(onError).toHaveBeenCalledTimes(1)
      const [err, context] = onError.mock.calls[0]
      expect(context).toEqual({ resolver: 'well-known', handle: 'alice.test' })
      expect(String((err as Error).message)).toContain('500')
    })

    it('network error returns null and forwards the underlying error to onError', async () => {
      const onError = vi.fn()
      const boom = new TypeError('fetch failed')
      const resolver = new WellKnownHandleResolver({
        fetch: fetchThrowing(boom),
        onError,
      })
      const result = await resolver.resolve('alice.test')
      expect(result).toBeNull()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toBe(boom)
    })

    it('a throwing onError handler cannot change the return contract (still resolves to null)', async () => {
      const resolver = new WellKnownHandleResolver({
        fetch: fetchReturning(() => new Response('x', { status: 503 })),
        onError: () => {
          throw new Error('handler boom')
        },
      })
      const result = await resolver.resolve('alice.test')
      expect(result).toBeNull()
    })

    it('non-2xx without an onError handler still returns null', async () => {
      const resolver = new WellKnownHandleResolver({
        fetch: fetchReturning(() => new Response('x', { status: 502 })),
      })
      await expect(resolver.resolve('alice.test')).resolves.toBeNull()
    })

    it('an already-aborted signal rejects and skips onError', async () => {
      const onError = vi.fn()
      const ac = new AbortController()
      ac.abort()
      const resolver = new WellKnownHandleResolver({
        fetch: fetchThrowing(new TypeError('net')),
        onError,
      })
      await expect(
        resolver.resolve('alice.test', { signal: ac.signal }),
      ).rejects.toThrow()
      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('AtprotoHandleResolver (DNS + well-known)', () => {
    it('resolves via well-known on a DNS miss', async () => {
      const resolver = new AtprotoHandleResolver({
        resolveTxt: async () => null,
        fetch: fetchReturning(() => new Response(DID)),
      })
      await expect(resolver.resolve('alice.test')).resolves.toBe(DID)
    })

    it('onError set on the instance fires for the well-known leg on a DNS miss', async () => {
      const onError = vi.fn()
      const resolver = new AtprotoHandleResolver({
        resolveTxt: async () => null,
        fetch: fetchReturning(() => new Response('x', { status: 500 })),
        onError,
      })
      await expect(resolver.resolve('alice.test')).resolves.toBeNull()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][1]).toEqual({
        resolver: 'well-known',
        handle: 'alice.test',
      })
    })

    it('a throwing onError on the well-known leg does not reject the composed resolve', async () => {
      // DNS miss forces the well-known leg; a 5xx there fires onError. Without
      // the guard, a throwing handler would intermittently reject resolve()
      // instead of returning null. This is the regression this test locks down.
      const resolver = new AtprotoHandleResolver({
        resolveTxt: async () => null,
        fetch: fetchReturning(() => new Response('x', { status: 500 })),
        onError: () => {
          throw new Error('handler boom')
        },
      })
      await expect(resolver.resolve('alice.test')).resolves.toBeNull()
    })

    it('prefers a DNS hit even when the well-known endpoint errors', async () => {
      const resolver = new AtprotoHandleResolver({
        resolveTxt: async () => [`did=${DID}`],
        fetch: fetchReturning(() => new Response('x', { status: 500 })),
      })
      await expect(resolver.resolve('bob.test')).resolves.toBe(DID)
    })
  })
})
