import { performance } from 'node:perf_hooks'
import { BackfillRateLimiter } from '../src/sequencer/backfill-rate-limiter.js'

it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid replay rate %s',
  (rate) => {
    expect(() => new BackfillRateLimiter(rate)).toThrow('positive integer')
  },
)

it('spaces page grants across concurrent consumers', async () => {
  const limiter = new BackfillRateLimiter(10000)
  const ac = new AbortController()
  const start = performance.now()
  const grants = await Promise.all(
    Array.from({ length: 3 }, async () => {
      expect(await limiter.wait(ac.signal)).toBe(true)
      return performance.now() - start
    }),
  )
  expect(limiter.pageSize).toBe(500)
  const sorted = grants.sort((a, b) => a - b)
  expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(45)
  expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(45)
})

it('uses smaller pages for low replay rates', () => {
  expect(new BackfillRateLimiter(10).pageSize).toBe(10)
})

it('does not consume capacity for an already cancelled request', async () => {
  const limiter = new BackfillRateLimiter(1)
  expect(await limiter.wait(AbortSignal.abort())).toBe(false)
  const ac = new AbortController()
  try {
    expect(await limiter.wait(ac.signal)).toBe(true)
  } finally {
    ac.abort()
  }
})
