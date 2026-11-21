import { jest } from '@jest/globals'
import { ProxyLimiter } from './proxy-limiter.js'

type Observed = { state: 'pending' | 'granted' | 'rejected' }

const observe = (acquisition: Promise<() => void>): Observed => {
  const observed: Observed = { state: 'pending' }
  acquisition.then(
    () => {
      observed.state = 'granted'
    },
    () => {
      observed.state = 'rejected'
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
})
