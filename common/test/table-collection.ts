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
  const ids = util.generateBulkIds(250)
  const mid = ids[125]
  for (const id of ids) {
    await collection.addEntry(id, cid)
  }

  t.deepEqual(await collection.getEntry(mid), cid, 'retrieves correct data')

  await collection.editEntry(mid, cid2)
  t.deepEqual(await collection.getEntry(mid), cid2, 'edits data')

  await collection.deleteEntry(mid)
  t.is(await collection.getEntry(mid), null, 'deletes data')
})

test('loads from blockstore', async (t) => {
  const { store, collection } = t.context as Context
  const bulkIds = util.generateBulkIds(450)
  const actual = {} as IdMapping
  for (const id of bulkIds) {
    const cid = await util.randomCid()
    await collection.addEntry(id, cid)
    actual[id.toString()] = cid
  }

  const fromBS = await TableCollection.load(store, collection.cid)
  for (const id of bulkIds) {
    const got = await fromBS.getEntry(id)
    t.deepEqual(got, actual[id.toString()], `Matching content for id: ${id}`)
  }
})

test('paginates gets', async (t) => {
  const { collection, cid } = t.context as Context
  const bulkIds = util.generateBulkIds(250)
  for (const id of bulkIds) {
    await collection.addEntry(id, cid)
  }
  const reversed = bulkIds.reverse()

  const fromStart = await collection.getEntries(75)
  t.deepEqual(
    fromStart.map((e) => e.id),
    reversed.slice(0, 75),
    'returns a slice from start of collection',
  )

  const middleSlice = await collection.getEntries(75, reversed[100])
  t.deepEqual(
    middleSlice.map((e) => e.id),
    reversed.slice(101, 176),
    'returns a slice from middle of collection',
  )

  const onEdge = await collection.getEntries(100, reversed[50])
  t.deepEqual(
    onEdge.map((e) => e.id),
    reversed.slice(51, 151),
    'returns a slice that falls on table edge',
  )

  const all = await collection.getEntries(300)
  t.deepEqual(
    all.map((e) => e.id),
    reversed,
    'returns the whole listing ',
  )
})

test('splits tables', async (t) => {
  const { collection, cid } = t.context as Context
  const ids = util.generateBulkIds(100)
  for (const id of ids) {
    await collection.addEntry(id, cid)
  }
  t.is(collection.tableCount(), 1, 'Does not split at 100 entries')

  await collection.addEntry(Timestamp.now(), cid)
  t.is(collection.tableCount(), 2, 'Does split at 101 entries')
})

test('compresses tables', async (t) => {
  const { collection, cid } = t.context as Context

  const ids = util.generateBulkIds(6401)
  const firstBatch = ids.slice(0, 400)
  const threshold = ids[400]
  const secondBatch = ids.slice(401, 6400)
  const final = ids[6400]
  for (const id of firstBatch) {
    await collection.addEntry(id, cid)
  }
  t.is(collection.tableCount(), 4, 'Does not compress at 4 tables')

  await collection.addEntry(threshold, cid)
  t.is(
    collection.tableCount(),
    2,
    'Compresses oldest 4 tables once there are 5 tables',
  )

  for (const id of secondBatch) {
    await collection.addEntry(id, cid)
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
