import { jest } from '@jest/globals'
import { ProxyLimitExceededError, ProxyLimiter } from './proxy-limiter.js'

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
})
