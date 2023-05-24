import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { DidResolver } from '@atproto/did-resolver'
import DidSqlCache from '../src/did-cache'
import { wait } from '@atproto/common'

describe('did cache', () => {
  let network: TestNetwork
  let sc: SeedClient
  let didResolver: DidResolver
  let didCache: DidSqlCache

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_did_cache',
    })
    didResolver = network.bsky.ctx.didResolver
    didCache = network.bsky.ctx.didCache
    const pdsAgent = new AtpAgent({ service: network.pds.url })
    sc = new SeedClient(pdsAgent)
    await userSeed(sc)
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
      didResolver.cache?.checkCache(alice),
      didResolver.cache?.checkCache(bob),
      didResolver.cache?.checkCache(carol),
      didResolver.cache?.checkCache(dan),
    ])
    expect(docs.length).toBe(4)
    expect(docs[0]?.doc.id).toEqual(alice)
    expect(docs[1]?.doc.id).toEqual(bob)
    expect(docs[2]?.doc.id).toEqual(carol)
    expect(docs[3]?.doc.id).toEqual(dan)
  })

  it('clears cache and repopulates', async () => {
    await didResolver.cache?.clear()
    const docsCleared = await Promise.all([
      didResolver.cache?.checkCache(alice),
      didResolver.cache?.checkCache(bob),
      didResolver.cache?.checkCache(carol),
      didResolver.cache?.checkCache(dan),
    ])
    expect(docsCleared).toEqual([null, null, null, null])

    await Promise.all([
      didResolver.resolveDid(alice),
      didResolver.resolveDid(bob),
      didResolver.resolveDid(carol),
      didResolver.resolveDid(dan),
    ])
    await didCache.processAll()

    const docs = await Promise.all([
      didResolver.cache?.checkCache(alice),
      didResolver.cache?.checkCache(bob),
      didResolver.cache?.checkCache(carol),
      didResolver.cache?.checkCache(dan),
    ])
    expect(docs.length).toBe(4)
    expect(docs[0]?.doc.id).toEqual(alice)
    expect(docs[1]?.doc.id).toEqual(bob)
    expect(docs[2]?.doc.id).toEqual(carol)
    expect(docs[3]?.doc.id).toEqual(dan)
  })

  it('accurately reports expired dids & refreshes the cache', async () => {
    const didCache = new DidSqlCache(network.bsky.ctx.db, 1, 60000)
    const shortCacheResolver = new DidResolver(
      { plcUrl: network.bsky.ctx.cfg.didPlcUrl },
      didCache,
    )
    const doc = await shortCacheResolver.resolveDid(alice)
    await didCache.processAll()
    // let's mess with alice's doc so we know what we're getting
    await didCache.cacheDid(alice, { ...doc, id: 'did:example:alice' })
    await wait(5)

    // first check the cache & see that we have the stale value
    const cached = await shortCacheResolver.cache?.checkCache(alice)
    expect(cached?.stale).toBe(true)
    expect(cached?.doc.id).toEqual('did:example:alice')
    // see that the resolver gives us the stale value while it revalidates
    const staleGet = await shortCacheResolver.resolveDid(alice)
    expect(staleGet?.id).toEqual('did:example:alice')
    await didCache.processAll()

    // since it revalidated, ensure we have the new value
    const updatedCache = await shortCacheResolver.cache?.checkCache(alice)
    expect(updatedCache?.doc.id).toEqual(alice)
    const updatedGet = await shortCacheResolver.resolveDid(alice)
    expect(updatedGet?.id).toEqual(alice)
    await didCache.destroy()
  })

  it('does not return expired dids & refreshes the cache', async () => {
    const didCache = new DidSqlCache(network.bsky.ctx.db, 0, 1)
    const shortExpireResolver = new DidResolver(
      { plcUrl: network.bsky.ctx.cfg.didPlcUrl },
      didCache,
    )
    const doc = await shortExpireResolver.resolveDid(alice)
    await didCache.processAll()

    // again, we mess with the cached doc so we get something different
    await didCache.cacheDid(alice, { ...doc, id: 'did:example:alice' })
    await wait(5)

    // see that the resolver does not return expired value & instead force refreshes
    const staleGet = await shortExpireResolver.resolveDid(alice)
    expect(staleGet?.id).toEqual(alice)
  })
})
