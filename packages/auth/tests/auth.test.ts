import { writeCap } from '../src/capabilities'
import { MemoryStore, Ucan, ucans, verifyAdxUcan } from '../src'

describe('tokens for post', () => {
  const collection = 'did:example:microblog'
  const schema = 'did:example:like'
  const record = '3iwc-gvs-ehpk-2s'
  const serverDid = 'did:example:fakeServerDid'

  let token: Ucan
  let rootDid: string
  let cap: ucans.Capability

  it('creates a token for a post', async () => {
    const authStore = await MemoryStore.load()
    await authStore.claimFull()
    rootDid = await authStore.did()

    // const cap = writeCap(await authStore.did())
    cap = writeCap(rootDid, collection, schema, record)
    token = await authStore.createUcan(serverDid, cap, 30)
  })

  it('validates a proper UCAN', async () => {
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
