import { wait } from '@atproto/common'
import { RedisCache } from '../src/cache/redis'
import { ReadThroughCache } from '../src/cache/read-through'

describe('redis cache', () => {
  let redisCache: RedisCache

  beforeAll(async () => {
    redisCache = new RedisCache(process.env.REDIS_HOST || '')
  })

  afterAll(async () => {
    await redisCache.close()
  })

  it('caches according to namespace', async () => {
    await Promise.all([
      redisCache.set('key', 'a', 'ns1'),
      redisCache.set('key', 'b', 'ns2'),
      redisCache.set('key', 'c'),
    ])
    const got = await Promise.all([
      redisCache.get('key', 'ns1'),
      redisCache.get('key', 'ns2'),
      redisCache.get('key'),
    ])
    expect(got[0]?.val).toEqual('a')
    expect(got[1]?.val).toEqual('b')
    expect(got[2]?.val).toEqual('c')

    await Promise.all([
      redisCache.setMany({ key1: 'a', key2: 'b' }, 'ns1'),
      redisCache.setMany({ key1: 'c', key2: 'd' }, 'ns2'),
      redisCache.setMany({ key1: 'e', key2: 'f' }),
    ])
    const gotMany = await Promise.all([
      redisCache.getMany(['key1', 'key2'], 'ns1'),
      redisCache.getMany(['key1', 'key2'], 'ns2'),
      redisCache.getMany(['key1', 'key2']),
    ])
    expect(gotMany[0]['key1']['val']).toEqual('a')
    expect(gotMany[0]['key2']['val']).toEqual('b')
    expect(gotMany[1]['key1']['val']).toEqual('c')
    expect(gotMany[1]['key2']['val']).toEqual('d')
    expect(gotMany[2]['key1']['val']).toEqual('e')
    expect(gotMany[2]['key2']['val']).toEqual('f')
  })

  it('caches values when empty', async () => {
    const vals = {
      '1': 'a',
      '2': 'b',
      '3': 'c',
    }
    let hits = 0
    const cache = new ReadThroughCache<string>(redisCache, {
      staleTTL: 60000,
      maxTTL: 60000,
      namespace: 'test1',
      fetchMethod: async (key) => {
        hits++
        return vals[key]
      },
    })
    const got = await Promise.all([
      cache.get('1'),
      cache.get('2'),
      cache.get('3'),
    ])
    expect(got[0]).toEqual('a')
    expect(got[1]).toEqual('b')
    expect(got[2]).toEqual('c')
    expect(hits).toBe(3)

    const refetched = await Promise.all([
      cache.get('1'),
      cache.get('2'),
      cache.get('3'),
    ])
    expect(refetched[0]).toEqual('a')
    expect(refetched[1]).toEqual('b')
    expect(refetched[2]).toEqual('c')
    expect(hits).toBe(3)
  })

  it('skips and refreshes cache when requested', async () => {
    let val = 'a'
    let hits = 0
    const cache = new ReadThroughCache<string>(redisCache, {
      staleTTL: 60000,
      maxTTL: 60000,
      namespace: 'test2',
      fetchMethod: async () => {
        hits++
        return val
      },
    })

    const try1 = await cache.get('1')
    expect(try1).toEqual('a')
    expect(hits).toBe(1)

    val = 'b'

    const try2 = await cache.get('1')
    expect(try2).toEqual('a')
    expect(hits).toBe(1)

    const try3 = await cache.get('1', { skipCache: true })
    expect(try3).toEqual('b')
    expect(hits).toBe(2)

    const try4 = await cache.get('1')
    expect(try4).toEqual('b')
    expect(hits).toBe(2)
  })

  it('accurately reports stale entries & refreshes the cache', async () => {
    let val = 'a'
    let hits = 0
    const cache = new ReadThroughCache<string>(redisCache, {
      staleTTL: 1,
      maxTTL: 60000,
      namespace: 'test3',
      fetchMethod: async () => {
        hits++
        return val
      },
    })

    const try1 = await cache.get('1')
    expect(try1).toEqual('a')

    await wait(5)

    val = 'b'

    const try2 = await cache.get('1')
    // cache gives us stale value while it revalidates
    expect(try2).toEqual('a')

    await wait(5)

    const try3 = await cache.get('1')
    expect(try3).toEqual('b')
    expect(hits).toEqual(3)
  })

  it('does not return expired dids & refreshes the cache', async () => {
    let val = 'a'
    let hits = 0
    const cache = new ReadThroughCache<string>(redisCache, {
      staleTTL: 0,
      maxTTL: 1,
      namespace: 'test4',
      fetchMethod: async () => {
        hits++
        return val
      },
    })

    const try1 = await cache.get('1')
    expect(try1).toEqual('a')

    await wait(5)

    val = 'b'

    const try2 = await cache.get('1')
    expect(try2).toEqual('b')
    expect(hits).toBe(2)
  })

  it('times out and fails open', async () => {
    let val = 'a'
    let hits = 0
    const cache = new ReadThroughCache<string>(redisCache, {
      staleTTL: 60000,
      maxTTL: 60000,
      namespace: 'test5',
      fetchMethod: async () => {
        hits++
        return val
      },
    })

    const try1 = await cache.get('1')
    expect(try1).toEqual('a')

    const orig = cache.redisCache.driver.get
    cache.redisCache.driver.get = async (key) => {
      await wait(100)
      return orig(key)
    }

    val = 'b'

    const try2 = await cache.get('1')
    expect(try2).toEqual('b')
    expect(hits).toBe(2)
  })
})
