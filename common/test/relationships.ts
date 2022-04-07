import test from 'ava'

import Relationships from '../src/repo/relationships.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import * as util from './_util.js'
import { Follow } from '../src/repo/types.js'
import { CID } from 'multiformats'

type Context = {
  store: IpldStore
  relationships: Relationships
  cid: CID
  cid2: CID
}

test.beforeEach(async (t) => {
  const store = IpldStore.createInMemory()
  const relationships = await Relationships.create(store)
  const cid = await util.randomCid()
  const cid2 = await util.randomCid()
  t.context = { store, relationships, cid, cid2 } as Context
  t.pass('Context setup')
})

test('basic operations', async (t) => {
  const { relationships } = t.context as Context

  // add some filler dids to build out the structure
  const follows = util.generateBulkFollows(100)
  for (const follow of follows) {
    await relationships.follow(follow.did, follow.username)
  }
  const did = util.randomDid()
  await relationships.follow(did, 'alice')

  let got = await relationships.getFollow(did)
  t.deepEqual(got?.username, 'alice', 'retrieves correct data')

  await relationships.unfollow(did)
  got = await relationships.getFollow(did)
  t.is(got, null, 'deletes data')
})

test('loads from blockstore', async (t) => {
  const { store, relationships } = t.context as Context
  const follows = util.generateBulkFollows(100)
  for (const follow of follows) {
    await relationships.follow(follow.did, follow.username)
  }
  const loaded = await Relationships.load(store, relationships.cid)
  for (const follow of follows) {
    const got = await loaded.getFollow(follow.did)
    t.deepEqual(got, follow, `Matching content for did: ${follow.did}`)
  }
})

test('enforces uniqueness on keys', async (t) => {
  const { relationships } = t.context as Context
  const did = util.randomDid()
  await relationships.follow(did, 'alice')
  await t.throwsAsync(
    relationships.follow(did, 'bob'),
    { instanceOf: Error },
    'throw when adding non-unique key',
  )
})

test('lists entries', async (t) => {
  const { relationships } = t.context as Context
  const follows = util.generateBulkFollows(50)
  for (const follow of follows) {
    await relationships.follow(follow.did, follow.username)
  }
  const sortFn = (a: Follow, b: Follow) => {
    if (a.did > b.did) return 1
    if (a.did < b.did) return -1
    return 0
  }
  const actual = await relationships.getFollows()

  t.deepEqual(
    actual.sort(sortFn),
    follows.sort(sortFn),
    'all added cids are in the entries list',
  )
})
