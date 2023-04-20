import AtpAgent from '@atproto/api'
import { TestEnvInfo, runTestEnv } from '@atproto/dev-env'
import { processAll } from './_util'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { DidResolver } from '@atproto/did-resolver'
import DidSqlCache from '../src/did-cache'
import { wait } from '@atproto/common'

describe('did cache', () => {
  let testEnv: TestEnvInfo
  let sc: SeedClient
  let didResolver: DidResolver

  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'bsky_did_cache',
    })
    didResolver = testEnv.bsky.ctx.didResolver
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await userSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await testEnv.close()
  })

  it('caches dids on lookup', async () => {
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

  it('accurately reports expired dids', async () => {
    const didCache = new DidSqlCache(testEnv.bsky.ctx.db, 1)
    const shortCacheResolver = new DidResolver(
      { plcUrl: testEnv.bsky.ctx.cfg.didPlcUrl },
      didCache,
    )
    await shortCacheResolver.resolveDid(alice)
    await wait(5)
    const cached = await shortCacheResolver.cache?.checkCache(alice)
    expect(cached?.expired).toBe(true)
  })
})
