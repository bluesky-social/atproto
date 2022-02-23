import test from 'ava'

import DidCollection from '../src/user-store/did-collection.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import * as util from './_util.js'
import { IdMapping } from '../src/user-store/types.js'
import { CID } from 'multiformats'

type Context = {
  store: IpldStore
  collection: DidCollection
  cid: CID
  cid2: CID
}

test.beforeEach(async (t) => {
  const store = IpldStore.createInMemory()
  const collection = await DidCollection.create(store)
  const cid = await util.randomCid()
  const cid2 = await util.randomCid()
  t.context = { store, collection, cid, cid2 } as Context
  t.pass('Context setup')
})

test('basic operations', async (t) => {
  const { collection, cid, cid2 } = t.context as Context

  // add some filler dids to build out the structure
  const dids = util.generateBulkDids(100)
  for (const did of dids) {
    await collection.addEntry(did, await util.randomCid())
  }
  const did = util.randomDid()
  await collection.addEntry(did, cid)

  t.deepEqual(await collection.getEntry(did), cid, 'retrieves correct data')

  await collection.editEntry(did, cid2)
  t.deepEqual(await collection.getEntry(did), cid2, 'edits data')

  await collection.deleteEntry(did)
  t.is(await collection.getEntry(did), null, 'deletes data')
})

test('loads from blockstore', async (t) => {
  const { store, collection } = t.context as Context
  const bulkDids = util.generateBulkDids(100)
  const actual = {} as IdMapping
  for (const did of bulkDids) {
    const cid = await util.randomCid()
    await collection.addEntry(did, cid)
    actual[did.toString()] = cid
  }
  const fromBS = await DidCollection.load(store, collection.cid)
  for (const did of bulkDids) {
    const got = await fromBS.getEntry(did)
    t.deepEqual(got, actual[did.toString()], `Matching content for did: ${did}`)
  }
})

test('enforces uniqueness on keys', async (t) => {
  const { collection, cid } = t.context as Context
  const did = util.randomDid()
  await collection.addEntry(did, cid)
  await t.throwsAsync(
    collection.addEntry(did, cid),
    { instanceOf: Error },
    'thorw when adding non-unique key',
  )
})

test('lists entries', async (t) => {
  const { collection } = t.context as Context
  const dids = util.generateBulkDids(50)
  const cids = []
  for (const did of dids) {
    const cid = await util.randomCid()
    cids.push(cid)
    await collection.addEntry(did, cid)
  }
  const entries = await collection.getEntries()
  const expected = cids.map((c) => c.toString()).sort()
  const actual = entries.map((c) => c.toString()).sort()

  t.deepEqual(actual, expected, 'all added cids are in the entries list')
})
