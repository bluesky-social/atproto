import { wait } from '@atproto/common'
import { Redis } from '../src/'
import { ReadThroughCache } from '../src/cache/read-through'

describe('redis cache', () => {
  let redis: Redis

  beforeAll(async () => {
    redis = new Redis({ host: process.env.REDIS_HOST || '' })
  })

  afterAll(async () => {
    await redis.destroy()
  })

  it('caches according to namespace', async () => {
    const ns1 = redis.withNamespace('ns1')
    const ns2 = redis.withNamespace('ns2')
    await Promise.all([
      ns1.set('key', 'a'),
      ns2.set('key', 'b'),
      redis.set('key', 'c'),
    ])
    const got = await Promise.all([
      ns1.get('key'),
      ns2.get('key'),
      redis.get('key'),
    ])
    expect(got[0]).toEqual('a')
    expect(got[1]).toEqual('b')
    expect(got[2]).toEqual('c')

    await Promise.all([
      ns1.setMulti({ key1: 'a', key2: 'b' }),
      ns2.setMulti({ key1: 'c', key2: 'd' }),
      redis.setMulti({ key1: 'e', key2: 'f' }),
    ])
    const gotMany = await Promise.all([
      ns1.getMulti(['key1', 'key2']),
      ns2.getMulti(['key1', 'key2']),
      redis.getMulti(['key1', 'key2']),
    ])
    expect(gotMany[0]['key1']).toEqual('a')
    expect(gotMany[0]['key2']).toEqual('b')
    expect(gotMany[1]['key1']).toEqual('c')
    expect(gotMany[1]['key2']).toEqual('d')
    expect(gotMany[2]['key1']).toEqual('e')
    expect(gotMany[2]['key2']).toEqual('f')
  })

  it('caches values when empty', async () => {
    const vals = {
      '1': 'a',
      '2': 'b',
      '3': 'c',
    }
    let hits = 0
    const cache = new ReadThroughCache<string>(redis.withNamespace('test1'), {
      staleTTL: 60000,
      maxTTL: 60000,
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
    const cache = new ReadThroughCache<string>(redis.withNamespace('test2'), {
      staleTTL: 60000,
      maxTTL: 60000,
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

    const try3 = await cache.get('1', { revalidate: true })
    expect(try3).toEqual('b')
    expect(hits).toBe(2)

    const try4 = await cache.get('1')
    expect(try4).toEqual('b')
    expect(hits).toBe(2)
  })

  it('accurately reports stale entries & refreshes the cache', async () => {
    let val = 'a'
    let hits = 0
    const cache = new ReadThroughCache<string>(redis.withNamespace('test3'), {
      staleTTL: 1,
      maxTTL: 60000,
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
    const cache = new ReadThroughCache<string>(redis.withNamespace('test4'), {
      staleTTL: 0,
      maxTTL: 1,
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

  it('caches negative values', async () => {
    let val: string | null = null
    let hits = 0
    const cache = new ReadThroughCache<string>(redis.withNamespace('test5'), {
      staleTTL: 60000,
      maxTTL: 60000,
      fetchMethod: async () => {
        hits++
        return val
      },
    })

    const try1 = await cache.get('1')
    expect(try1).toEqual(null)
    expect(hits).toBe(1)

    val = 'b'

    const try2 = await cache.get('1')
    // returns cached negative value
    expect(try2).toEqual(null)
    expect(hits).toBe(1)

    const try3 = await cache.get('1', { revalidate: true })
    expect(try3).toEqual('b')
    expect(hits).toEqual(2)

    const try4 = await cache.get('1')
    expect(try4).toEqual('b')
    expect(hits).toEqual(2)
  })

  it('times out and fails open', async () => {
    let val = 'a'
    let hits = 0
    const cache = new ReadThroughCache<string>(redis.withNamespace('test6'), {
      staleTTL: 60000,
      maxTTL: 60000,
      fetchMethod: async () => {
        hits++
        return val
      },
    })

    const try1 = await cache.get('1')
    expect(try1).toEqual('a')

    const orig = cache.redis.driver.get
    cache.redis.driver.get = async (key) => {
      await wait(600)
      return orig(key)
    }

    val = 'b'

    const try2 = await cache.get('1')
    expect(try2).toEqual('b')
    expect(hits).toBe(2)
  })
})
