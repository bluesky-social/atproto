import { once } from 'node:events'
import { createServer } from 'node:http'
import { type Dispatcher, request } from 'undici'
import { describe, expect, it } from 'vitest'
import type { ServerConfig } from '../config.js'
import { createBlobDispatcher } from './blob-dispatcher.js'

const createConfig = (
  proxyMaxRetries: number,
  overrides: Partial<ServerConfig> = {},
) =>
  ({
    disableSsrfProtection: true,
    proxyAllowHTTP2: false,
    proxyBodyTimeout: 30e3,
    proxyHeadersTimeout: 30e3,
    proxyMaxResponseSize: 10 * 1024 * 1024,
    proxyMaxRetries,
    ...overrides,
  }) as ServerConfig

async function getRequestCount(statusCode: number, proxyMaxRetries: number) {
  let requestCount = 0
  await using server = createServer((_req, res) => {
    requestCount += 1
    res.writeHead(statusCode).end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Expected server to listen on a TCP port')
  }

  const dispatcher = createBlobDispatcher(createConfig(proxyMaxRetries))
  try {
    await expect(
      request(`http://127.0.0.1:${address.port}`, { dispatcher }),
    ).rejects.toMatchObject({ statusCode })
  } finally {
    await dispatcher.close()
  }

  return requestCount
}

// A loopback origin that holds each response open long enough for concurrent
// requests to overlap, and records the highest number of them in flight.
async function slowOrigin() {
  const state = { inFlight: 0, maxInFlight: 0, requestCount: 0 }
  const server = createServer((_req, res) => {
    state.inFlight += 1
    state.requestCount += 1
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
    setTimeout(() => {
      state.inFlight -= 1
      res.writeHead(200).end('ok')
    }, 25)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Expected server to listen on a TCP port')
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    state,
    async close() {
      server.closeAllConnections()
      server.close()
      await once(server, 'close')
    },
  }
}

async function burst(origin: string, dispatcher: Dispatcher, n: number) {
  return Promise.all(
    Array.from({ length: n }, async () => {
      const res = await request(origin, { dispatcher })
      return { statusCode: res.statusCode, body: await res.body.text() }
    }),
  )
}

describe(createBlobDispatcher, () => {
  it('does not retry 429 responses', async () => {
    expect(await getRequestCount(429, 3)).toBe(1)
  })

  it('retains the configured retry count for other statuses', async () => {
    expect(await getRequestCount(503, 2)).toBe(3)
  })

  it('keeps unbounded clients and origins when no caps are configured', async () => {
    const a = await slowOrigin()
    const b = await slowOrigin()
    const c = await slowOrigin()
    const dispatcher = createBlobDispatcher(createConfig(0))
    try {
      // No origin cap: three distinct origins are all reachable.
      for (const { origin } of [a, b, c]) {
        const [res] = await burst(origin, dispatcher, 1)
        expect(res.statusCode).toBe(200)
      }
      // No connection cap: concurrent requests to one origin fan out.
      const results = await burst(a.origin, dispatcher, 6)
      expect(results.map((res) => res.body)).toEqual(Array(6).fill('ok'))
      expect(a.state.maxInFlight).toBe(6)
    } finally {
      await dispatcher.close()
      await Promise.all([a.close(), b.close(), c.close()])
    }
  })

  it('caps concurrent clients per origin with proxyPoolConnections', async () => {
    const target = await slowOrigin()
    const dispatcher = createBlobDispatcher(
      createConfig(0, { proxyPoolConnections: 2 }),
    )
    try {
      const results = await burst(target.origin, dispatcher, 6)
      expect(results.map((res) => res.body)).toEqual(Array(6).fill('ok'))
      expect(target.state.requestCount).toBe(6)
      expect(target.state.maxInFlight).toBe(2)
    } finally {
      await dispatcher.close()
      await target.close()
    }
  })

  it('serializes requests to one origin with proxyPoolConnections=1', async () => {
    const target = await slowOrigin()
    const dispatcher = createBlobDispatcher(
      createConfig(0, { proxyPoolConnections: 1 }),
    )
    try {
      const results = await burst(target.origin, dispatcher, 4)
      expect(results.map((res) => res.body)).toEqual(Array(4).fill('ok'))
      expect(target.state.maxInFlight).toBe(1)
    } finally {
      await dispatcher.close()
      await target.close()
    }
  })

  it('rejects additional origins once proxyMaxOrigins is reached', async () => {
    const a = await slowOrigin()
    const b = await slowOrigin()
    const dispatcher = createBlobDispatcher(
      createConfig(0, { proxyMaxOrigins: 1 }),
    )
    try {
      const [first] = await burst(a.origin, dispatcher, 1)
      expect(first.statusCode).toBe(200)
      // The already-seen origin keeps working...
      const [again] = await burst(a.origin, dispatcher, 1)
      expect(again.statusCode).toBe(200)
      // ...while a new origin is refused instead of opening another pool.
      await expect(
        request(b.origin, { dispatcher }).then((res) => res.body.dump()),
      ).rejects.toMatchObject({ code: 'UND_ERR_MAX_ORIGINS_REACHED' })
      expect(b.state.requestCount).toBe(0)
    } finally {
      await dispatcher.close()
      await Promise.all([a.close(), b.close()])
    }
  })
})
