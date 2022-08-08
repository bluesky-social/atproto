import Relationships from '../src/repo/relationships'
import IpldStore from '../src/blockstore/ipld-store'
import * as util from './_util'
import { Follow } from '../src/repo/types'

describe('relationships', () => {
  let store: IpldStore
  let relationships: Relationships
  const follows = util.generateBulkFollows(100)

  it('is created', async () => {
    store = IpldStore.createInMemory()
    relationships = await Relationships.create(store)
  })

  const aliceDid = util.randomDid()

  it('adds user follows', async () => {
    // add some filler dids to build out the structure
    for (const follow of follows) {
      await relationships.follow(follow.did, follow.username)
    }
    await relationships.follow(aliceDid, 'alice')
  })

  it('gets user follows', async () => {
    const got = await relationships.getFollow(aliceDid)
    expect(got?.username).toEqual('alice')
  })

  it('deletes user follows', async () => {
    await relationships.unfollow(aliceDid)
    const got = await relationships.getFollow(aliceDid)
    expect(got).toEqual(null)
  })

  it('loads from blockstore', async () => {
    const loaded = await Relationships.load(store, relationships.cid)
    for (const follow of follows) {
      const got = await loaded.getFollow(follow.did)
      expect(got).toEqual(follow)
    }
  })

  it('lists entries', async () => {
    const sortFn = (a: Follow, b: Follow) => {
      if (a.did > b.did) return 1
      if (a.did < b.did) return -1
      return 0
    }
    const actual = await relationships.getFollows()

    expect(actual.sort(sortFn)).toEqual(follows.sort(sortFn))
  })

  it('enforces uniqueness on keys', async () => {
    await relationships.follow(aliceDid, 'alice')
    try {
      await relationships.follow(aliceDid, 'bob')
      // shouldn't reach this
      expect(false).toBeTruthy()
    } catch (err) {
      expect(err instanceof Error).toBeTruthy()
    }
  })
})
