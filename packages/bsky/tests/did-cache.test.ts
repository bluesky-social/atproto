import AtpAgent from '@atproto/api'
import { TestEnvInfo, runTestEnv } from '@atproto/dev-env'
import { processAll } from './_util'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { DidResolver } from '@atproto/did-resolver'

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
    expect(docs[0]?.did).toEqual(alice)
    expect(docs[1]?.did).toEqual(bob)
    expect(docs[2]?.did).toEqual(carol)
    expect(docs[3]?.did).toEqual(dan)
  })
})
