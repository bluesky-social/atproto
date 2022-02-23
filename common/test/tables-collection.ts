import test from 'ava'
import { CID } from 'multiformats'

import TableCollection from '../src/user-store/tables-collection.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import Timestamp from '../src/user-store/timestamp.js'
import * as util from './_util.js'
import { IdMapping } from '../src/user-store/types/index.js'

type Context = {
  store: IpldStore
  collection: TableCollection
  cid: CID
  cid2: CID
}

test.beforeEach(async (t) => {
  const store = IpldStore.createInMemory()
  const collection = await TableCollection.create(store)
  const cid = await util.randomCid()
  const cid2 = await util.randomCid()
  t.context = { store, collection, cid, cid2 } as Context
  t.pass('Context setup')
})

test('basic operations', async (t) => {
  const { collection, cid, cid2 } = t.context as Context

  // do basic operations in a collection that has at least 3 tables
  const tids = util.generateBulkTids(250)
  const mid = tids[125]
  for (const tid of tids) {
    await collection.addEntry(tid, cid)
  }

  t.deepEqual(await collection.getEntry(mid), cid, 'retrieves correct data')

  await collection.editEntry(mid, cid2)
  t.deepEqual(await collection.getEntry(mid), cid2, 'edits data')

  await collection.deleteEntry(mid)
  t.is(await collection.getEntry(mid), null, 'deletes data')
})

test('loads from blockstore', async (t) => {
  const { store, collection } = t.context as Context
  const bulkTids = util.generateBulkTids(450)
  const actual = {} as IdMapping
  for (const tid of bulkTids) {
    const cid = await util.randomCid()
    await collection.addEntry(tid, cid)
    actual[tid.toString()] = cid
  }

  const fromBS = await TableCollection.load(store, collection.cid)
  for (const tid of bulkTids) {
    const got = await fromBS.getEntry(tid)
    t.deepEqual(got, actual[tid.toString()], `Matching content for tid: ${tid}`)
  }
})

test('paginates gets', async (t) => {
  const { collection, cid } = t.context as Context
  const bulkTids = util.generateBulkTids(250)
  for (const tid of bulkTids) {
    await collection.addEntry(tid, cid)
  }
  const reversed = bulkTids.reverse()

  const fromStart = await collection.getEntries(75)
  t.deepEqual(
    fromStart.map((e) => e.tid),
    reversed.slice(0, 75),
    'returns a slice from start of collection',
  )

  const middleSlice = await collection.getEntries(75, reversed[100])
  t.deepEqual(
    middleSlice.map((e) => e.tid),
    reversed.slice(101, 176),
    'returns a slice from middle of collection',
  )

  const onEdge = await collection.getEntries(100, reversed[50])
  t.deepEqual(
    onEdge.map((e) => e.tid),
    reversed.slice(51, 151),
    'returns a slice that falls on table edge',
  )

  const all = await collection.getEntries(300)
  t.deepEqual(
    all.map((e) => e.tid),
    reversed,
    'returns the whole listing ',
  )
})

test('splits tables', async (t) => {
  const { collection, cid } = t.context as Context
  const tids = util.generateBulkTids(100)
  for (const tid of tids) {
    await collection.addEntry(tid, cid)
  }
  t.is(collection.tableCount(), 1, 'Does not split at 100 entries')

  await collection.addEntry(Timestamp.now(), cid)
  t.is(collection.tableCount(), 2, 'Does split at 101 entries')
})

test('compresses tables', async (t) => {
  const { collection, cid } = t.context as Context

  const tids = util.generateBulkTids(6401)
  const firstBatch = tids.slice(0, 400)
  const threshold = tids[400]
  const secondBatch = tids.slice(401, 6400)
  const final = tids[6400]
  for (const tid of firstBatch) {
    await collection.addEntry(tid, cid)
  }
  t.is(collection.tableCount(), 4, 'Does not compress at 4 tables')

  await collection.addEntry(threshold, cid)
  t.is(
    collection.tableCount(),
    2,
    'Compresses oldest 4 tables once there are 5 tables',
  )

  for (const tid of secondBatch) {
    await collection.addEntry(tid, cid)
  }
  t.is(
    collection.tableCount(),
    10,
    'Does not compress at any level until necessary',
  )

  await collection.addEntry(final, cid)
  t.is(
    collection.tableCount(),
    2,
    'Cascades compression of all tables to an xl table',
  )
})
