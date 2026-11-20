import { describe, expect, it } from 'vitest'
import { createRedis } from './redis.js'

describe('createRedis', () => {
  it('keeps the RESP2 protocol of ioredis 5 by default', () => {
    const redis = createRedis({ lazyConnect: true })
    expect(redis.options.protocol).toBe(2)
    expect(redis.options.disableClientInfo).toBe(true)
  })

  it('uses the protocol set in RedisOptions', () => {
    const redis = createRedis({ lazyConnect: true, protocol: 3 })
    expect(redis.options.protocol).toBe(3)
  })
})
