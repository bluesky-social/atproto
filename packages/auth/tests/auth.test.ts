import { writeCap } from '../src/adx-capabilities'
import { Verifier, AuthStore, Ucan, ucans } from '../src'

describe('tokens for post', () => {
  const collection = 'com.example.microblog'
  const record = '3iwc-gvs-ehpk-2s'
  const serverDid = 'did:example:fakeServerDid'

  const verifier = new Verifier()

  let authStore: AuthStore
  let token: Ucan
  let rootDid: string
  let cap: ucans.Capability
  let fullUcan: Ucan

  it('validates a fully claimed ucan from the root DID', async () => {
    authStore = await verifier.createTempAuthStore()
    fullUcan = await authStore.claimFull()
    rootDid = await authStore.did()

    cap = writeCap(rootDid, collection, record)

    await verifier.verifyAdxUcan(fullUcan, fullUcan.payload.aud, cap)
  })

  it('creates a valid token for a post', async () => {
    token = await authStore.createUcan(serverDid, cap, 30)
    await verifier.verifyAdxUcan(token, serverDid, cap)
  })

  it('throws an error for the wrong collection', async () => {
    const collectionCap = writeCap(
      rootDid,
      'com.example.otherCollection',
      record,
    )
    try {
      const res = await verifier.verifyAdxUcan(token, serverDid, collectionCap)
      expect(res).toBe(null)
    } catch (err) {
      expect(err).toBeTruthy()
    }
  })

  it('throws an error for the wrong record name', async () => {
    const recordCap = writeCap(rootDid, collection, '3iwc-gvs-ehpk-2z')
    try {
      const res = await verifier.verifyAdxUcan(token, serverDid, recordCap)
      expect(res).toBe(null)
    } catch (err) {
      expect(err).toBeTruthy()
    }
  })
})
