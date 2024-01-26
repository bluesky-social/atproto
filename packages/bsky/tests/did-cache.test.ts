import { TestNetwork, SeedClient, usersSeed } from '@atproto/dev-env'
import { IdResolver } from '@atproto/identity'
import DidRedisCache from '../src/did-cache'
import { wait } from '@atproto/common'
import { Redis } from '../src'

describe('did cache', () => {
  let network: TestNetwork
  let sc: SeedClient
  let idResolver: IdResolver
  let redis: Redis
  let didCache: DidRedisCache

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_did_cache',
    })
    idResolver = network.bsky.indexer.ctx.idResolver
    redis = network.bsky.indexer.ctx.redis
    didCache = network.bsky.indexer.ctx.didCache
    sc = network.getSeedClient()
    await usersSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  it('caches dids on lookup', async () => {
    await didCache.processAll()
    const docs = await Promise.all([
      idResolver.did.cache?.checkCache(alice),
      idResolver.did.cache?.checkCache(bob),
      idResolver.did.cache?.checkCache(carol),
      idResolver.did.cache?.checkCache(dan),
    ])
    expect(docs.length).toBe(4)
    expect(docs[0]?.doc.id).toEqual(alice)
    expect(docs[1]?.doc.id).toEqual(bob)
    expect(docs[2]?.doc.id).toEqual(carol)
    expect(docs[3]?.doc.id).toEqual(dan)
  })

  it('clears cache and repopulates', async () => {
    await Promise.all([
      idResolver.did.cache?.clearEntry(alice),
      idResolver.did.cache?.clearEntry(bob),
      idResolver.did.cache?.clearEntry(carol),
      idResolver.did.cache?.clearEntry(dan),
    ])
    const docsCleared = await Promise.all([
      idResolver.did.cache?.checkCache(alice),
      idResolver.did.cache?.checkCache(bob),
      idResolver.did.cache?.checkCache(carol),
      idResolver.did.cache?.checkCache(dan),
    ])
    expect(docsCleared).toEqual([null, null, null, null])

    await Promise.all([
      idResolver.did.resolve(alice),
      idResolver.did.resolve(bob),
      idResolver.did.resolve(carol),
      idResolver.did.resolve(dan),
    ])
    await didCache.processAll()

    const docs = await Promise.all([
      idResolver.did.cache?.checkCache(alice),
      idResolver.did.cache?.checkCache(bob),
      idResolver.did.cache?.checkCache(carol),
      idResolver.did.cache?.checkCache(dan),
    ])
    expect(docs.length).toBe(4)
    expect(docs[0]?.doc.id).toEqual(alice)
    expect(docs[1]?.doc.id).toEqual(bob)
    expect(docs[2]?.doc.id).toEqual(carol)
    expect(docs[3]?.doc.id).toEqual(dan)
  })

  it('accurately reports expired dids & refreshes the cache', async () => {
    const didCache = new DidRedisCache(redis.withNamespace('did-doc'), {
      staleTTL: 1,
      maxTTL: 60000,
    })
    const shortCacheResolver = new IdResolver({
      plcUrl: network.bsky.ctx.cfg.didPlcUrl,
      didCache,
    })
    const doc = await shortCacheResolver.did.resolve(alice)
    await didCache.processAll()
    // let's mess with alice's doc so we know what we're getting
    await didCache.cacheDid(alice, { ...doc, id: 'did:example:alice' })
    await wait(5)

    // first check the cache & see that we have the stale value
    const cached = await shortCacheResolver.did.cache?.checkCache(alice)
    expect(cached?.stale).toBe(true)
    expect(cached?.doc.id).toEqual('did:example:alice')
    // see that the resolver gives us the stale value while it revalidates
    const staleGet = await shortCacheResolver.did.resolve(alice)
    expect(staleGet?.id).toEqual('did:example:alice')
    await didCache.processAll()

    // since it revalidated, ensure we have the new value
    const updatedCache = await shortCacheResolver.did.cache?.checkCache(alice)
    expect(updatedCache?.doc.id).toEqual(alice)
    const updatedGet = await shortCacheResolver.did.resolve(alice)
    expect(updatedGet?.id).toEqual(alice)
    await didCache.destroy()
  })

  it('does not return expired dids & refreshes the cache', async () => {
    const didCache = new DidRedisCache(redis.withNamespace('did-doc'), {
      staleTTL: 0,
      maxTTL: 1,
    })
    const shortExpireResolver = new IdResolver({
      plcUrl: network.bsky.ctx.cfg.didPlcUrl,
      didCache,
    })
    const doc = await shortExpireResolver.did.resolve(alice)
    await didCache.processAll()

    // again, we mess with the cached doc so we get something different
    await didCache.cacheDid(alice, { ...doc, id: 'did:example:alice' })
    await wait(5)

    // see that the resolver does not return expired value & instead force refreshes
    const staleGet = await shortExpireResolver.did.resolve(alice)
    expect(staleGet?.id).toEqual(alice)
    await didCache.destroy()
  })
})
