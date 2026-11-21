import { once } from 'node:events'
import http from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { jest } from '@jest/globals'
import { Agent } from 'undici'
import {
  ProxyLimitExceededError,
  ProxyLimiter,
  limiterInterceptor,
} from './proxy-limiter.js'

type Observed = {
  state: 'pending' | 'granted' | 'rejected'
  error?: unknown
}

const observe = (acquisition: Promise<() => void>): Observed => {
  const observed: Observed = { state: 'pending' }
  acquisition.then(
    () => {
      observed.state = 'granted'
    },
    (error: unknown) => {
      observed.state = 'rejected'
      observed.error = error
    },
  )
  return observed
}

describe('ProxyLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('grants at most N acquisitions in any 1000 ms window', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 2,
      maxConcurrentRequests: 100,
      maxQueuedRequests: 100,
      maxQueueMs: 60_000,
    })

    const first = observe(limiter.acquire())
    await jest.advanceTimersByTimeAsync(400)
    const second = observe(limiter.acquire())
    const third = observe(limiter.acquire())
    const fourth = observe(limiter.acquire())

    // 1 ms before the first grant leaves the window
    await jest.advanceTimersByTimeAsync(599)
    expect([first, second, third, fourth].map((o) => o.state)).toEqual([
      'granted',
      'granted',
      'pending',
      'pending',
    ])

    // The first grant (t=0) has left the window; the second (t=400) has not
    await jest.advanceTimersByTimeAsync(1)
    expect([third.state, fourth.state]).toEqual(['granted', 'pending'])

    await jest.advanceTimersByTimeAsync(399)
    expect(fourth.state).toBe('pending')
    await jest.advanceTimersByTimeAsync(1)
    expect(fourth.state).toBe('granted')
  })

  it('holds the M+1th acquisition until an in-flight grant is released', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 1000,
      maxConcurrentRequests: 2,
      maxQueuedRequests: 100,
      maxQueueMs: 60_000,
    })

    const release = await limiter.acquire()
    await limiter.acquire()
    const third = observe(limiter.acquire())

    // Time alone does not free a slot
    await jest.advanceTimersByTimeAsync(5000)
    expect(third.state).toBe('pending')

    release()
    await jest.advanceTimersByTimeAsync(0)
    expect(third.state).toBe('granted')
  })

  it('frees one slot when a release function is called twice', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 1000,
      maxConcurrentRequests: 2,
      maxQueuedRequests: 100,
      maxQueueMs: 60_000,
    })

    const release = await limiter.acquire()
    await limiter.acquire()
    const third = observe(limiter.acquire())
    const fourth = observe(limiter.acquire())

    release()
    release()
    await jest.advanceTimersByTimeAsync(0)
    expect([third.state, fourth.state]).toEqual(['granted', 'pending'])
  })

  it('rejects an acquisition when the queue is full', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 2,
      maxConcurrentRequests: 100,
      maxQueuedRequests: 3,
      maxQueueMs: 60_000,
    })

    const granted = [limiter.acquire(), limiter.acquire()].map(observe)
    const queued = [
      limiter.acquire(),
      limiter.acquire(),
      limiter.acquire(),
    ].map(observe)
    const overflow = observe(limiter.acquire())

    await jest.advanceTimersByTimeAsync(0)
    expect(granted.map((o) => o.state)).toEqual(['granted', 'granted'])
    expect(queued.map((o) => o.state)).toEqual([
      'pending',
      'pending',
      'pending',
    ])
    expect(overflow.state).toBe('rejected')
    expect(overflow.error).toBeInstanceOf(ProxyLimitExceededError)
    // 3 queued requests drain in 1.5 s at 2 requests per second
    expect(overflow.error).toMatchObject({ retryAfterMs: 1500 })
  })

  it('grants an acquisition that need not wait even with no queue', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 1,
      maxConcurrentRequests: 100,
      maxQueuedRequests: 0,
      maxQueueMs: 60_000,
    })

    const first = observe(limiter.acquire())
    const second = observe(limiter.acquire())

    await jest.advanceTimersByTimeAsync(0)
    expect([first.state, second.state]).toEqual(['granted', 'rejected'])
  })

  it('rejects a waiter that has queued for maxQueueMs', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 1000,
      maxConcurrentRequests: 1,
      maxQueuedRequests: 100,
      maxQueueMs: 500,
    })

    const release = await limiter.acquire()
    const early = observe(limiter.acquire())
    await jest.advanceTimersByTimeAsync(200)
    const late = observe(limiter.acquire())

    await jest.advanceTimersByTimeAsync(299)
    expect([early.state, late.state]).toEqual(['pending', 'pending'])

    await jest.advanceTimersByTimeAsync(1)
    expect([early.state, late.state]).toEqual(['rejected', 'pending'])
    expect(early.error).toBeInstanceOf(ProxyLimitExceededError)

    // The expired waiter no longer holds a place: the next slot goes to late
    release()
    await jest.advanceTimersByTimeAsync(0)
    expect(late.state).toBe('granted')
  })

  it('treats 0 as no limit for the rate and for the in-flight cap', async () => {
    const unrated = new ProxyLimiter({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 3,
      maxQueuedRequests: 1,
      maxQueueMs: 60_000,
    })
    const releases = await Promise.all([
      unrated.acquire(),
      unrated.acquire(),
      unrated.acquire(),
    ])
    const queued = observe(unrated.acquire())
    const overflow = observe(unrated.acquire())
    await jest.advanceTimersByTimeAsync(0)
    expect([queued.state, overflow.state]).toEqual(['pending', 'rejected'])
    if (!(overflow.error instanceof ProxyLimitExceededError)) {
      throw new Error('expected a ProxyLimitExceededError')
    }
    // No rate to estimate a drain time from
    expect(overflow.error.retryAfterMs).toBeGreaterThanOrEqual(1000)
    releases[0]()
    await jest.advanceTimersByTimeAsync(0)
    expect(queued.state).toBe('granted')

    const uncapped = new ProxyLimiter({
      maxRequestsPerSecond: 3,
      maxConcurrentRequests: 0,
      maxQueuedRequests: 100,
      maxQueueMs: 60_000,
    })
    const granted = [
      uncapped.acquire(),
      uncapped.acquire(),
      uncapped.acquire(),
    ].map(observe)
    const fourth = observe(uncapped.acquire())
    await jest.advanceTimersByTimeAsync(999)
    expect(granted.map((o) => o.state)).toEqual([
      'granted',
      'granted',
      'granted',
    ])
    expect(fourth.state).toBe('pending')
    await jest.advanceTimersByTimeAsync(1)
    expect(fourth.state).toBe('granted')
  })
})

class InspectableLimiter extends ProxyLimiter {
  get recordedGrants(): number {
    return this.grantTimes.length
  }
}

describe('ProxyLimiter memory', () => {
  it('keeps no record of grants when there is no rate limit', async () => {
    const limiter = new InspectableLimiter({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 10,
      maxQueuedRequests: 10,
      maxQueueMs: 1000,
    })

    for (let i = 0; i < 1000; i++) {
      const release = await limiter.acquire()
      release()
    }

    expect(limiter.recordedGrants).toBe(0)
  })
})

describe('ProxyLimiter observer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('reports each grant with the time the request waited', async () => {
    const waits: number[] = []
    const limiter = new ProxyLimiter(
      {
        maxRequestsPerSecond: 1,
        maxConcurrentRequests: 100,
        maxQueuedRequests: 100,
        maxQueueMs: 60_000,
      },
      { granted: (waitMs) => waits.push(waitMs), rejected: () => {} },
    )

    await limiter.acquire()
    expect(waits).toEqual([0])

    await jest.advanceTimersByTimeAsync(400)
    const second = observe(limiter.acquire())
    // The first grant (t=0) leaves the window at t=1000
    await jest.advanceTimersByTimeAsync(600)
    expect(second.state).toBe('granted')
    expect(waits).toEqual([0, 600])
  })

  it('reports a request turned away by a full queue', async () => {
    const rejections: string[] = []
    const limiter = new ProxyLimiter(
      {
        maxRequestsPerSecond: 1,
        maxConcurrentRequests: 100,
        maxQueuedRequests: 0,
        maxQueueMs: 60_000,
      },
      { granted: () => {}, rejected: (reason) => rejections.push(reason) },
    )

    await limiter.acquire()
    const overflow = observe(limiter.acquire())
    await jest.advanceTimersByTimeAsync(0)
    expect(overflow.state).toBe('rejected')
    expect(rejections).toEqual(['queue_full'])
  })

  it('reports a request that queued too long', async () => {
    const rejections: string[] = []
    const limiter = new ProxyLimiter(
      {
        maxRequestsPerSecond: 1000,
        maxConcurrentRequests: 1,
        maxQueuedRequests: 100,
        maxQueueMs: 500,
      },
      { granted: () => {}, rejected: (reason) => rejections.push(reason) },
    )

    await limiter.acquire()
    const waiting = observe(limiter.acquire())
    await jest.advanceTimersByTimeAsync(500)
    expect(waiting.state).toBe('rejected')
    expect(rejections).toEqual(['queue_timeout'])
  })
})

describe('limiterInterceptor', () => {
  let server: http.Server
  let origin: string
  let arrivals: number
  let held: http.ServerResponse[]
  let holding: boolean

  beforeEach(async () => {
    arrivals = 0
    held = []
    holding = true
    server = http.createServer((_req, res) => {
      arrivals++
      if (holding) held.push(res)
      else res.end()
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('expected a TCP address')
    }
    origin = `http://127.0.0.1:${address.port}`
  })

  // Also answers requests that arrive later, so that cleanup after a failed
  // expectation cannot wait on a request that has not reached the server yet.
  const releaseAll = () => {
    holding = false
    for (const res of held.splice(0)) res.end()
  }

  afterEach(async () => {
    releaseAll()
    server.close()
    await once(server, 'close')
  })

  const respond = () => {
    const res = held.shift()
    if (!res) throw new Error('no request is waiting for a response')
    res.end('ok')
  }

  it('sends a request only once the limiter grants it', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 1,
      maxQueuedRequests: 10,
      maxQueueMs: 60_000,
    })
    const agent = new Agent().compose(limiterInterceptor(limiter))
    try {
      const first = agent.request({ origin, path: '/', method: 'GET' })
      const second = agent.request({ origin, path: '/', method: 'GET' })

      await sleep(100)
      expect(arrivals).toBe(1)

      respond()
      await (await first).body.text()
      await sleep(100)
      expect(arrivals).toBe(2)

      respond()
      await (await second).body.text()
    } finally {
      // Answer anything still waiting first: close() waits for requests in
      // flight, so a failed expectation would otherwise hang the test.
      releaseAll()
      await agent.close()
    }
  })

  it('frees the slot of a request that failed', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 1,
      maxQueuedRequests: 10,
      maxQueueMs: 60_000,
    })
    const agent = new Agent().compose(limiterInterceptor(limiter))
    try {
      // Port 9 (discard) is closed, so the connection is refused.
      const failed = agent.request({
        origin: 'http://127.0.0.1:9',
        path: '/',
        method: 'GET',
      })
      await expect(failed).rejects.toThrow()

      const next = agent.request({ origin, path: '/', method: 'GET' })
      await sleep(100)
      expect(arrivals).toBe(1)

      respond()
      await (await next).body.text()
    } finally {
      releaseAll()
      await agent.close()
    }
  })

  it('fails a request the limiter turns away with the limiter error', async () => {
    const limiter = new ProxyLimiter({
      maxRequestsPerSecond: 0,
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
      maxQueueMs: 60_000,
    })
    const agent = new Agent().compose(limiterInterceptor(limiter))
    try {
      const first = agent.request({ origin, path: '/', method: 'GET' })
      const second = agent.request({ origin, path: '/', method: 'GET' })

      await expect(second).rejects.toBeInstanceOf(ProxyLimitExceededError)
      await sleep(100)
      expect(arrivals).toBe(1)

      respond()
      await (await first).body.text()
    } finally {
      releaseAll()
      await agent.close()
    }
  })
})
