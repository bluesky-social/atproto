import getPort from 'get-port'
import * as plc from '@did-plc/lib'
import { Database as DidPlcDb, PlcServer } from '@did-plc/server'
import { MemoryCache } from '../src/did/memory-cache'
import { DidResolver } from '../src'
import { Secp256k1Keypair } from '@atproto/crypto'
import { wait } from '@atproto/common-web'

describe('did cache', () => {
  let close: () => Promise<void>
  let plcUrl: string
  let did: string

  let didCache: MemoryCache
  let didResolver: DidResolver

  beforeAll(async () => {
    const plcDB = DidPlcDb.mock()
    const plcPort = await getPort()
    const plcServer = PlcServer.create({ db: plcDB, port: plcPort })
    await plcServer.start()

    plcUrl = 'http://localhost:' + plcPort

    const signingKey = await Secp256k1Keypair.create()
    const rotationKey = await Secp256k1Keypair.create()
    const plcClient = new plc.Client(plcUrl)
    did = await plcClient.createDid({
      signingKey: signingKey.did(),
      handle: 'alice.test',
      pds: 'https://bsky.social',
      rotationKeys: [rotationKey.did()],
      signer: rotationKey,
    })

    didCache = new MemoryCache()
    didResolver = new DidResolver({ plcUrl, didCache })

    close = async () => {
      await plcServer.destroy()
    }
  })

  afterAll(async () => {
    await close()
  })

  it('caches dids on lookup', async () => {
    const resolved = await didResolver.resolve(did)
    expect(resolved?.id).toBe(did)

    const cached = await didResolver.cache?.checkCache(did)
    expect(cached?.did).toBe(did)
    expect(cached?.doc).toEqual(resolved)
  })

  it('clears cache and repopulates', async () => {
    await didResolver.cache?.clear()
    await didResolver.resolve(did)

    const cached = await didResolver.cache?.checkCache(did)
    expect(cached?.did).toBe(did)
    expect(cached?.doc.id).toEqual(did)
  })

  it('accurately reports stale dids & refreshes the cache', async () => {
    const didCache = new MemoryCache(1)
    const shortCacheResolver = new DidResolver({ plcUrl, didCache })
    const doc = await shortCacheResolver.resolve(did)

    // let's mess with the cached doc so we get something different
    await didCache.cacheDid(did, { ...doc, id: 'did:example:alice' })
    await wait(5)

    // first check the cache & see that we have the stale value
    const cached = await shortCacheResolver.cache?.checkCache(did)
    expect(cached?.stale).toBe(true)
    expect(cached?.doc.id).toEqual('did:example:alice')
    // see that the resolver gives us the stale value while it revalidates
    const staleGet = await shortCacheResolver.resolve(did)
    expect(staleGet?.id).toEqual('did:example:alice')

    // since it revalidated, ensure we have the new value
    const updatedCache = await shortCacheResolver.cache?.checkCache(did)
    expect(updatedCache?.doc.id).toEqual(did)
    const updatedGet = await shortCacheResolver.resolve(did)
    expect(updatedGet?.id).toEqual(did)
  })

  it('does not return expired dids & refreshes the cache', async () => {
    const didCache = new MemoryCache(0, 1)
    const shortExpireResolver = new DidResolver({ plcUrl, didCache })
    const doc = await shortExpireResolver.resolve(did)

    // again, we mess with the cached doc so we get something different
    await didCache.cacheDid(did, { ...doc, id: 'did:example:alice' })
    await wait(5)

    // see that the resolver does not return expired value & instead force refreshes
    const staleGet = await shortExpireResolver.resolve(did)
    expect(staleGet?.id).toEqual(did)
  })
})
