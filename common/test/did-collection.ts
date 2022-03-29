import test from 'ava'

import Relationships from '../src/repo/relationships.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import * as util from './_util.js'
import { IdMapping } from '../src/repo/types.js'
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
  const { relationships, cid, cid2 } = t.context as Context

  // add some filler dids to build out the structure
  const dids = util.generateBulkDids(100)
  for (const did of dids) {
    await relationships.addEntry(did, await util.randomCid())
  }
  const did = util.randomDid()
  await relationships.addEntry(did, cid)

  t.deepEqual(await relationships.getEntry(did), cid, 'retrieves correct data')

  await relationships.editEntry(did, cid2)
  t.deepEqual(await relationships.getEntry(did), cid2, 'edits data')

  await relationships.deleteEntry(did)
  t.is(await relationships.getEntry(did), null, 'deletes data')
})

test('loads from blockstore', async (t) => {
  const { store, relationships } = t.context as Context
  const bulkDids = util.generateBulkDids(100)
  const actual = {} as IdMapping
  for (const did of bulkDids) {
    const cid = await util.randomCid()
    await relationships.addEntry(did, cid)
    actual[did.toString()] = cid
  }
  const loaded = await Relationships.load(store, relationships.cid)
  for (const did of bulkDids) {
    const got = await loaded.getEntry(did)
    t.deepEqual(got, actual[did.toString()], `Matching content for did: ${did}`)
  }
})

test('enforces uniqueness on keys', async (t) => {
  const { relationships, cid } = t.context as Context
  const did = util.randomDid()
  await relationships.addEntry(did, cid)
  await t.throwsAsync(
    relationships.addEntry(did, cid),
    { instanceOf: Error },
    'thorw when adding non-unique key',
  )
})

test('lists entries', async (t) => {
  const { relationships } = t.context as Context
  const dids = util.generateBulkDids(50)
  const cids = []
  for (const did of dids) {
    const cid = await util.randomCid()
    cids.push(cid)
    await relationships.addEntry(did, cid)
  }
  const entries = await relationships.getEntries()
  const expected = cids.map((c) => c.toString()).sort()
  const actual = entries.map((c) => c.toString()).sort()

  t.deepEqual(actual, expected, 'all added cids are in the entries list')
})
