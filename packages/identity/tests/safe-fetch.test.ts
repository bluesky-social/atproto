import { jest } from '@jest/globals'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import { DidResolver, HandleResolver } from '../src/index.js'

describe('injected fetch', () => {
  it('routes the handle well-known request through the injected fetch', async () => {
    const fetch = jest.fn(async () => new Response('did:plc:abc123\n'))
    const resolver = new HandleResolver({ fetch })

    expect(await resolver.resolveHttp('alice.test')).toBe('did:plc:abc123')
    expect(fetch).toHaveBeenCalledTimes(1)

    const [input, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(input)).toBe('https://alice.test/.well-known/atproto-did')
    expect(init.redirect).toBe('follow')
  })

  it('routes did:plc through the injected fetch', async () => {
    const fetch = jest.fn(async () => Response.json({ id: 'did:plc:abc123' }))
    const resolver = new DidResolver({
      plcUrl: 'https://plc.example.com',
      timeout: 1000,
      fetch,
    })

    await resolver.resolveNoCheck('did:plc:abc123')

    const [input, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(input)).toBe('https://plc.example.com/did%3Aplc%3Aabc123')
    expect(init.redirect).toBe('error')
  })

  it('routes did:web through the injected fetch', async () => {
    const fetch = jest.fn(async () =>
      Response.json({ id: 'did:web:example.com' }),
    )
    const resolver = new DidResolver({ timeout: 1000, fetch })

    await resolver.resolveNoCheck('did:web:example.com')

    const [input, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(input)).toBe('https://example.com/.well-known/did.json')
    expect(init.redirect).toBe('error')
  })

  it('still infers http for a localhost did:web', async () => {
    const fetch = jest.fn(async () =>
      Response.json({ id: 'did:web:localhost%3A2583' }),
    )
    const resolver = new DidResolver({ timeout: 1000, fetch })

    await resolver.resolveNoCheck('did:web:localhost%3A2583')

    const [input] = fetch.mock.calls[0] as unknown as [URL]
    expect(String(input)).toBe('http://localhost:2583/.well-known/did.json')
  })

  it('works with a strict safeFetchWrap that forbids implicit redirects', async () => {
    // Regression guard: if the implementation ever normalizes (url, init) into
    // a Request before calling the injected fetch, the explicit-redirect check
    // throws 'Request redirect must be "error" or "manual"' and resolveHttp
    // silently returns undefined. A plain stub fetch cannot catch that; only a
    // real strict wrapper can.
    const fetch = safeFetchWrap({
      allowImplicitRedirect: false,
      ssrfProtection: false,
      fetch: async () => new Response('did:plc:abc123\n'),
    })
    const resolver = new HandleResolver({ fetch })

    expect(await resolver.resolveHttp('alice.test')).toBe('did:plc:abc123')
  })
})

describe('timeouts', () => {
  function hangingFetch() {
    const seen: { reason?: Error } = {}
    const fetch = jest.fn(
      (_input: string | Request | URL, init: RequestInit = {}) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            seen.reason = (init.signal as AbortSignal).reason
            reject(seen.reason)
          })
        }),
    )
    return { fetch, seen }
  }

  it('bounds the handle well-known request with opts.timeout', async () => {
    const { fetch, seen } = hangingFetch()
    const resolver = new HandleResolver({ timeout: 10, fetch })

    expect(await resolver.resolveHttp('slow.test')).toBeUndefined()
    expect(seen.reason?.name).toBe('TimeoutError')
  })

  it('preserves the caller signal alongside the timeout', async () => {
    const { fetch, seen } = hangingFetch()
    const resolver = new HandleResolver({ timeout: 10_000, fetch })
    const controller = new AbortController()

    const promise = resolver.resolveHttp('alice.test', controller.signal)
    controller.abort()

    expect(await promise).toBeUndefined()
    expect(seen.reason?.name).toBe('AbortError')
  })
})

describe('response body cancellation', () => {
  function cancellableBody() {
    const state = { cancelled: false }
    const body = new ReadableStream({
      cancel() {
        state.cancelled = true
      },
    })
    return { body, state }
  }

  it('cancels the body when did:plc returns 404', async () => {
    const { body, state } = cancellableBody()
    const fetch = jest.fn(async () => new Response(body, { status: 404 }))
    const resolver = new DidResolver({
      plcUrl: 'https://plc.example.com',
      timeout: 1000,
      fetch,
    })

    expect(await resolver.resolveNoCheck('did:plc:abc123')).toBeNull()
    expect(state.cancelled).toBe(true)
  })

  it('cancels the body when did:plc returns a server error', async () => {
    const { body, state } = cancellableBody()
    const fetch = jest.fn(
      async () => new Response(body, { status: 500, statusText: 'Nope' }),
    )
    const resolver = new DidResolver({
      plcUrl: 'https://plc.example.com',
      timeout: 1000,
      fetch,
    })

    await expect(resolver.resolveNoCheck('did:plc:abc123')).rejects.toThrow(
      'Nope',
    )
    expect(state.cancelled).toBe(true)
  })

  it('cancels the body when did:web returns a non-ok status', async () => {
    const { body, state } = cancellableBody()
    const fetch = jest.fn(async () => new Response(body, { status: 500 }))
    const resolver = new DidResolver({ timeout: 1000, fetch })

    expect(await resolver.resolveNoCheck('did:web:example.com')).toBeNull()
    expect(state.cancelled).toBe(true)
  })
})

describe('default fetch is SSRF-protected', () => {
  // Each case asserts the request is refused *before* it reaches the network.
  // `rejects.toThrow()` alone would pass without the change, since dialing
  // 127.0.0.1:443 fails with ECONNREFUSED anyway. Spying on globalThis.fetch
  // separates "blocked by policy" from "connection refused". safeFetchWrap
  // captures globalThis.fetch when the resolver is constructed, so the spy has
  // to be installed first. mockRestore in a finally, matching the neighbouring
  // jest precedent in packages/ozone/tests/safe-fetch.test.ts.

  it('refuses did:web on a loopback address without dialing', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('should not be dialed'))
    try {
      const resolver = new DidResolver({ timeout: 1000 })
      await expect(
        resolver.resolveNoCheck('did:web:127.0.0.1'),
      ).rejects.toThrow()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('refuses did:web on a link-local address without dialing', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('should not be dialed'))
    try {
      const resolver = new DidResolver({ timeout: 1000 })
      await expect(
        resolver.resolveNoCheck('did:web:169.254.169.254'),
      ).rejects.toThrow()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('refuses did:web on a custom port without dialing', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('should not be dialed'))
    try {
      const resolver = new DidResolver({ timeout: 1000 })
      await expect(
        resolver.resolveNoCheck('did:web:example.social%3A3000'),
      ).rejects.toThrow()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('refuses did:web on localhost without dialing', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('should not be dialed'))
    try {
      const resolver = new DidResolver({ timeout: 1000 })
      await expect(
        resolver.resolveNoCheck('did:web:localhost'),
      ).rejects.toThrow()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('refuses a loopback handle host without dialing', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('should not be dialed'))
    try {
      const resolver = new HandleResolver({ timeout: 1000 })
      // resolveHttp swallows every error, so a block surfaces as undefined.
      expect(await resolver.resolveHttp('127.0.0.1')).toBeUndefined()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('dials through the default fetch for a public host', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ id: 'did:web:example.social' }))
    try {
      // The spy must be installed before construction: safeFetchWrap captures
      // globalThis.fetch when createDefaultFetch() runs, which is at construction.
      const resolver = new DidResolver({ timeout: 1000 })
      await resolver.resolveNoCheck('did:web:example.social')
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
