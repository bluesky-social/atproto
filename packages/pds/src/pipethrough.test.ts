import dns from 'node:dns'
import { Resolver } from 'node:dns/promises'
import { once } from 'node:events'
import http from 'node:http'
import type { LookupFunction } from 'node:net'
import { jest } from '@jest/globals'
import type { ProxyConfig } from './config/config.js'
import { buildProxyAgent, retryAfterSeconds } from './pipethrough.js'
import { ProxyLimitExceededError, ProxyLimiter } from './proxy-limiter.js'

class CountingLimiter extends ProxyLimiter {
  acquisitions = 0

  override acquire(): Promise<() => void> {
    this.acquisitions++
    return super.acquire()
  }
}

const proxyConfig: ProxyConfig = {
  disableSsrfProtection: true,
  useSystemDnsLookup: false,
  allowHTTP2: false,
  headersTimeout: 10e3,
  bodyTimeout: 30e3,
  maxResponseSize: 1024,
  maxRetries: 1,
  preferCompressed: false,
}

describe('buildProxyAgent', () => {
  let server: http.Server
  let origin: string
  let arrivals: number

  beforeEach(async () => {
    arrivals = 0
    // Drops the first connection without answering, which the agent retries.
    server = http.createServer((req, res) => {
      arrivals++
      if (arrivals === 1) req.socket.destroy()
      else res.end('ok')
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('expected a TCP address')
    }
    origin = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    server.close()
    await once(server, 'close')
  })

  it('takes a limiter grant for every attempt, retries included', async () => {
    const limiter = new CountingLimiter({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 0,
      maxQueuedRequests: 0,
      maxQueueMs: 0,
    })
    const agent = buildProxyAgent(proxyConfig, limiter)
    try {
      const res = await agent.request({ origin, path: '/', method: 'GET' })
      await res.body.text()

      expect(arrivals).toBe(2)
      expect(limiter.acquisitions).toBe(2)
    } finally {
      await agent.close()
    }
  })

  it('does not retry a request the limiter turned away', async () => {
    const limiter = new CountingLimiter({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
      maxQueueMs: 0,
    })
    const agent = buildProxyAgent(proxyConfig, limiter)
    const release = await limiter.acquire()
    try {
      await expect(
        agent.request({ origin, path: '/', method: 'GET' }),
      ).rejects.toBeInstanceOf(ProxyLimitExceededError)

      // One for the slot held above, one for the request: a retry would be a third.
      expect(limiter.acquisitions).toBe(2)
      expect(arrivals).toBe(0)
    } finally {
      release()
      await agent.close()
    }
  })
})

describe('buildProxyAgent hostname resolution', () => {
  // Both the resolver and `dns.lookup` answer with a loopback address, which
  // the unicast check refuses: nothing is ever dialed.
  const origin = 'https://pds.example.social'

  function stubLookups() {
    const resolve4 = jest
      .spyOn(Resolver.prototype, 'resolve4')
      .mockResolvedValue(['127.0.0.1'])
    const resolve6 = jest
      .spyOn(Resolver.prototype, 'resolve6')
      .mockResolvedValue([])
    const lookup = jest.spyOn(dns, 'lookup').mockImplementation(((
      _hostname,
      options,
      callback,
    ) => {
      if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }])
      else callback(null, '127.0.0.1', 4)
    }) satisfies LookupFunction as typeof dns.lookup)
    return {
      resolve4,
      resolve6,
      lookup,
      [Symbol.dispose]() {
        resolve4.mockRestore()
        resolve6.mockRestore()
        lookup.mockRestore()
      },
    }
  }

  it('queries DNS with a dns.Resolver', async () => {
    using stubs = stubLookups()
    const agent = buildProxyAgent({
      ...proxyConfig,
      disableSsrfProtection: false,
    })
    try {
      await expect(
        agent.request({ origin, path: '/', method: 'GET' }),
      ).rejects.toThrow('Hostname resolved to non-unicast address')

      expect(stubs.resolve4).toHaveBeenCalledWith('pds.example.social')
      expect(stubs.lookup).not.toHaveBeenCalled()
    } finally {
      await agent.close()
    }
  })

  it('uses dns.lookup with useSystemDnsLookup', async () => {
    using stubs = stubLookups()
    const agent = buildProxyAgent({
      ...proxyConfig,
      disableSsrfProtection: false,
      useSystemDnsLookup: true,
    })
    try {
      await expect(
        agent.request({ origin, path: '/', method: 'GET' }),
      ).rejects.toThrow('Hostname resolved to non-unicast address')

      expect(stubs.lookup).toHaveBeenCalledWith(
        'pds.example.social',
        expect.anything(),
        expect.any(Function),
      )
      expect(stubs.resolve4).not.toHaveBeenCalled()
      expect(stubs.resolve6).not.toHaveBeenCalled()
    } finally {
      await agent.close()
    }
  })

  it('runs one dns.lookup at a time with useSystemDnsLookup, across agents', async () => {
    // Answered (with loopback) when the test says so
    const answers: (() => void)[] = []
    using lookup = jest.spyOn(dns, 'lookup').mockImplementation(((
      _hostname,
      options,
      callback,
    ) => {
      answers.push(() => {
        if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }])
        else callback(null, '127.0.0.1', 4)
      })
    }) satisfies LookupFunction as typeof dns.lookup)

    const cfg = {
      ...proxyConfig,
      disableSsrfProtection: false,
      useSystemDnsLookup: true,
      // A retry would queue another lookup, never answered
      maxRetries: 0,
    }
    const agents = [buildProxyAgent(cfg), buildProxyAgent(cfg)]
    try {
      const requests = agents.map((agent, i) =>
        agent
          .request({
            origin: `https://pds${i}.example.social`,
            path: '/',
            method: 'GET',
          })
          .catch((err: unknown) => err),
      )

      await until(() => lookup.mock.calls.length > 0)
      // Long enough for the other agent's connection to reach its lookup
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(lookup).toHaveBeenCalledTimes(1)

      answers[0]()
      await until(() => lookup.mock.calls.length > 1)
      answers[1]()

      for (const err of await Promise.all(requests)) {
        expect(err).toMatchObject({
          message: 'Hostname resolved to non-unicast address',
        })
      }
    } finally {
      await Promise.all(agents.map((agent) => agent.close()))
    }
  })
})

async function until(condition: () => boolean) {
  while (!condition()) await new Promise((resolve) => setImmediate(resolve))
}

describe('retryAfterSeconds', () => {
  it('spreads clients over 5 seconds past the time the queue needs to drain', () => {
    expect(retryAfterSeconds(2500, () => 0)).toBe(3)
    expect(retryAfterSeconds(2500, () => 0.5)).toBe(6)
    expect(retryAfterSeconds(2500, () => 0.999)).toBe(8)
  })
})
