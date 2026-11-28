import { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'
import { buildOAuthRateLimiterFactory } from './rate-limits.js'

describe('oauth rate limiter factory', () => {
  const options = { points: 2, durationMs: 60_000 }

  it('reports exceeded limits as negative remaining points, without throwing', async () => {
    const limiter = buildOAuthRateLimiterFactory()({
      name: 'test-exceed',
      ...options,
    })

    await expect(limiter.consume('k', 1)).resolves.toMatchObject({
      remainingPoints: 1,
    })
    // Last allowed point
    await expect(limiter.consume('k', 1)).resolves.toMatchObject({
      remainingPoints: 0,
    })

    const result = await limiter.consume('k', 1)
    expect(result.remainingPoints).toBe(-1)
    expect(result.msBeforeNext).toBeGreaterThan(0)
    expect(result.msBeforeNext).toBeLessThanOrEqual(options.durationMs)

    // Other keys are not affected
    await expect(limiter.consume('other', 1)).resolves.toMatchObject({
      remainingPoints: 1,
    })
  })

  it('fails open when the backend fails', async () => {
    // Unreachable, and rejecting commands instead of queuing them
    const redis = new Redis({
      port: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
    })

    try {
      const limiter = buildOAuthRateLimiterFactory(redis)({
        name: 'test-failure',
        ...options,
      })

      for (let i = 0; i < 5; i++) {
        await expect(limiter.consume('k', 1)).resolves.toEqual({
          remainingPoints: 2,
          msBeforeNext: 0,
        })
      }
    } finally {
      redis.disconnect()
    }
  })
})
