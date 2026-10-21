import { jest } from '@jest/globals'
import type { DidDocument } from '../types.js'
import { DidResolver } from './did-resolver.js'
import { MemoryCache } from './memory-cache.js'

function document(id: string, padding = ''): DidDocument {
  return { id, alsoKnownAs: [padding] }
}

function entryBytes(did: string, doc: DidDocument): number {
  return Buffer.byteLength(did) + Buffer.byteLength(JSON.stringify(doc))
}

describe('MemoryCache bounds', () => {
  it('bounds the number of distinct DIDs with the default configuration', async () => {
    const cache = new MemoryCache()
    for (let i = 0; i < 10_001; i++) {
      const did = `did:web:tenant${i}.example.com`
      await cache.cacheDid(did, { id: did })
    }
    expect(cache.cache.size).toBe(10_000)
    expect(await cache.checkCache('did:web:tenant0.example.com')).toBeNull()
  })

  it('resolves large documents without retaining them, including failed atproto lookups', async () => {
    const cache = new MemoryCache()
    const resolver = new DidResolver({
      didCache: cache,
      fetch: async (input) => {
        const did = `did:web:${new URL(String(input)).hostname}`
        return Response.json({ id: did, alsoKnownAs: ['x'.repeat(460_000)] })
      },
    })
    const did = 'did:web:large.example.com'
    expect((await resolver.resolve(did))?.id).toBe(did)
    await expect(resolver.resolveAtprotoData(did)).rejects.toThrow()
    expect(await cache.checkCache(did)).toBeNull()
  })

  it('evicts the least recently used document without resetting its age', async () => {
    using now = jest.spyOn(Date, 'now').mockReturnValue(1000)
    const cache = new MemoryCache(10, 100, { maxEntries: 2 })
    await cache.cacheDid('a', document('a'))
    await cache.cacheDid('b', document('b'))
    now.mockReturnValue(1005)
    expect((await cache.checkCache('a'))?.updatedAt).toBe(1000)
    await cache.cacheDid('c', document('c'))
    expect(await cache.checkCache('b')).toBeNull()
    expect(await cache.checkCache('a')).not.toBeNull()
    expect(await cache.checkCache('c')).not.toBeNull()
  })

  it('bounds serialized bytes as well as entry count, including UTF-8 keys', async () => {
    const dids = ['did:web:a.example', 'did:web:b.example', 'did:web:c.example']
    const padding = '😀'.repeat(100)
    const size = entryBytes(dids[0], document(dids[0], padding))
    const cache = new MemoryCache(undefined, undefined, { maxBytes: size * 2 })
    for (const did of dids) {
      await cache.cacheDid(did, document(did, padding))
    }
    expect(await cache.checkCache(dids[0])).toBeNull()
    expect(await cache.checkCache(dids[1])).not.toBeNull()
    expect(await cache.checkCache(dids[2])).not.toBeNull()
    expect(cache.cache.size).toBe(2)
  })

  it('enforces the default byte budget before reaching the entry limit', async () => {
    const cache = new MemoryCache()
    for (let i = 0; i < 600; i++) {
      const did = `did:web:tenant${i}.example.com`
      await cache.cacheDid(did, document(did, 'x'.repeat(60 * 1024)))
    }
    const size = [...cache.cache].reduce(
      (sum, [did, { doc }]) => sum + entryBytes(did, doc),
      0,
    )
    expect(size).toBeLessThanOrEqual(32 * 1024 * 1024)
    expect(cache.cache.size).toBeGreaterThan(500)
    expect(await cache.checkCache('did:web:tenant0.example.com')).toBeNull()
  })

  it('skips oversized UTF-8 documents without evicting other entries', async () => {
    const cache = new MemoryCache(undefined, undefined, { maxDocBytes: 100 })
    await cache.cacheDid('a', document('a'))
    await cache.cacheDid('b', document('b', '😀'.repeat(30)))
    expect(await cache.checkCache('a')).not.toBeNull()
    expect(await cache.checkCache('b')).toBeNull()
  })

  it('does not evict other entries for a document larger than the total budget', async () => {
    const cache = new MemoryCache(undefined, undefined, {
      maxBytes: 100,
      maxDocBytes: 1000,
    })
    await cache.cacheDid('a', document('a'))
    await cache.cacheDid('b', document('b', 'x'.repeat(200)))
    expect(await cache.checkCache('a')).not.toBeNull()
    expect(await cache.checkCache('b')).toBeNull()
  })

  it('drops a previous version when its replacement becomes too large', async () => {
    const cache = new MemoryCache(undefined, undefined, { maxDocBytes: 100 })
    await cache.cacheDid('a', document('a'))
    await cache.cacheDid('a', document('a', 'x'.repeat(100)))
    expect(await cache.checkCache('a')).toBeNull()
  })

  it('accounts for replacements, explicit removal, and clearing the cache', async () => {
    const doc = document('a')
    const cache = new MemoryCache(undefined, undefined, {
      maxBytes: entryBytes('a', doc) * 2,
    })
    await cache.cacheDid('a', doc)
    await cache.cacheDid('a', doc)
    await cache.cacheDid('b', document('b'))
    expect(cache.cache.size).toBe(2)
    await cache.clearEntry('a')
    await cache.clearEntry('absent')
    await cache.cacheDid('c', document('c'))
    expect(await cache.checkCache('b')).not.toBeNull()
    expect(await cache.checkCache('c')).not.toBeNull()
    await cache.clear()
    await cache.cacheDid('a', doc)
    await cache.cacheDid('b', document('b'))
    expect(cache.cache.size).toBe(2)
  })

  it('treats a replacement as the most recently used entry', async () => {
    const cache = new MemoryCache(undefined, undefined, { maxEntries: 2 })
    await cache.cacheDid('a', document('a'))
    await cache.cacheDid('b', document('b'))
    await cache.cacheDid('a', document('a', 'updated'))
    await cache.cacheDid('c', document('c'))
    expect((await cache.checkCache('a'))?.doc).toEqual(document('a', 'updated'))
    expect(await cache.checkCache('b')).toBeNull()
  })

  it('preserves fresh, stale, and expired TTL boundaries and releases expired entries', async () => {
    using now = jest.spyOn(Date, 'now').mockReturnValue(1000)
    const cache = new MemoryCache(10, 20)
    await cache.cacheDid('a', document('a'))
    now.mockReturnValue(1010)
    expect(await cache.checkCache('a')).toEqual({
      did: 'a',
      doc: document('a'),
      updatedAt: 1000,
      stale: false,
      expired: false,
    })
    now.mockReturnValue(1011)
    expect(await cache.checkCache('a')).toMatchObject({
      stale: true,
      expired: false,
    })
    now.mockReturnValue(1020)
    expect((await cache.checkCache('a'))?.expired).toBe(false)
    now.mockReturnValue(1021)
    expect(await cache.checkCache('a')).toMatchObject({
      stale: true,
      expired: true,
    })
    expect(cache.cache.size).toBe(0)
    expect(await cache.checkCache('a')).toBeNull()
  })

  it('applies the same bounds during refresh and preserves entries on null or failure', async () => {
    const cache = new MemoryCache(undefined, undefined, { maxEntries: 1 })
    await cache.cacheDid('a', document('a'))
    await cache.refreshCache('a', async () => null)
    await expect(
      cache.refreshCache('a', async () => {
        throw new Error('fetch failed')
      }),
    ).rejects.toThrow('fetch failed')
    expect(await cache.checkCache('a')).not.toBeNull()
    await cache.refreshCache('b', async () => document('b'))
    expect(await cache.checkCache('a')).toBeNull()
    expect(await cache.checkCache('b')).not.toBeNull()
  })

  it('does not fail resolution when a document cannot be serialized', async () => {
    const doc = document('a')
    doc.service = [{ id: '#service', type: 'example', serviceEndpoint: doc }]
    const cache = new MemoryCache()
    await cache.cacheDid('a', doc)
    expect(await cache.checkCache('a')).toBeNull()
  })

  it.each(['maxEntries', 'maxBytes', 'maxDocBytes'] as const)(
    'allows %s to disable retention',
    async (limit) => {
      const cache = new MemoryCache(undefined, undefined, { [limit]: 0 })
      await cache.cacheDid('a', document('a'))
      expect(await cache.checkCache('a')).toBeNull()
    },
  )

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid bounds: %s',
    (limit) => {
      for (const name of ['maxEntries', 'maxBytes', 'maxDocBytes']) {
        expect(
          () => new MemoryCache(undefined, undefined, { [name]: limit }),
        ).toThrow(RangeError)
      }
    },
  )

  it('serves retained documents without fetching again', async () => {
    const cache = new MemoryCache()
    const fetch = jest.fn(async () =>
      Response.json(document('did:web:example.com')),
    )
    const resolver = new DidResolver({ didCache: cache, fetch })
    await resolver.resolve('did:web:example.com')
    await resolver.resolve('did:web:example.com')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
