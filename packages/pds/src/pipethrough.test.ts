import { once } from 'node:events'
import http from 'node:http'
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

describe('retryAfterSeconds', () => {
  it('spreads clients over 5 seconds past the time the queue needs to drain', () => {
    expect(retryAfterSeconds(2500, () => 0)).toBe(3)
    expect(retryAfterSeconds(2500, () => 0.5)).toBe(6)
    expect(retryAfterSeconds(2500, () => 0.999)).toBe(8)
  })
})
