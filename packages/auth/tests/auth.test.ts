import { writeCap } from '../src/capabilities'
import { AuthStore, MemoryStore, Ucan, ucans, verifyAdxUcan } from '../src'

describe('tokens for post', () => {
  const collection = 'did:example:microblog'
  const schema = 'did:example:like'
  const record = '3iwc-gvs-ehpk-2s'
  const serverDid = 'did:example:fakeServerDid'

  let authStore: AuthStore
  let token: Ucan
  let rootDid: string
  let cap: ucans.Capability
  let fullUcan: Ucan

  it('validates a fully claimed ucan from the root DID', async () => {
    authStore = await MemoryStore.load()
    fullUcan = await authStore.claimFull()
    rootDid = await authStore.did()

    cap = writeCap(rootDid, collection, schema, record)

    await verifyAdxUcan(fullUcan, fullUcan.payload.aud, cap)
  })

  it('creates a valid token for a post', async () => {
    token = await authStore.createUcan(serverDid, cap, 30)
    await verifyAdxUcan(token, serverDid, cap)
  })

  it('throws an error for the wrong collection', async () => {
    const collectionCap = writeCap(
      rootDid,
      'did:example:otherCollection',
      schema,
      record,
    )
    try {
      const res = await verifyAdxUcan(token, serverDid, collectionCap)
      expect(res).toBe(null)
    } catch (err) {
      expect(err).toBeTruthy()
    }
  })

  it('throws an error for the wrong record name', async () => {
    const recordCap = writeCap(rootDid, collection, schema, '3iwc-gvs-ehpk-2z')
    try {
      const res = await verifyAdxUcan(token, serverDid, recordCap)
      expect(res).toBe(null)
    } catch (err) {
      expect(err).toBeTruthy()
    }
  })
})
