import test from 'ava'
import { CID } from 'multiformats'

import Branch from '../src/user-store/branch.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import Timestamp from '../src/timestamp.js'
import * as util from './_util.js'
import { IdMapping } from '../src/types.js'

type Context = {
  store: IpldStore
  branch: Branch
  cid: CID
  cid2: CID
}

test.beforeEach(async (t) => {
  const store = IpldStore.createInMemory()
  const branch = await Branch.create(store)
  const cid = await util.randomCid()
  const cid2 = await util.randomCid()
  t.context = { store, branch, cid, cid2 } as Context
  t.pass('Context setup')
})

test('basic operations', async (t) => {
  const { branch, cid, cid2 } = t.context as Context

  // do basic operations in a branch that has at least 3 tables
  const ids = util.generateBulkIds(250)
  const mid = ids[125]
  for (const id of ids) {
    await branch.addEntry(id, cid)
  }

  t.deepEqual(await branch.getEntry(mid), cid, 'retrieves correct data')

  await branch.editEntry(mid, cid2)
  t.deepEqual(await branch.getEntry(mid), cid2, 'edits data')

  await branch.deleteEntry(mid)
  t.is(await branch.getEntry(mid), null, 'deletes data')
})

test('loads from blockstore', async (t) => {
  const { store, branch } = t.context as Context
  const bulkIds = util.generateBulkIds(450)
  const actual = {} as IdMapping
  for (const id of bulkIds) {
    const cid = await util.randomCid()
    await branch.addEntry(id, cid)
    actual[id.toString()] = cid
  }

  const fromBS = await Branch.get(store, branch.cid)
  for (const id of bulkIds) {
    const got = await fromBS.getEntry(id)
    t.deepEqual(got, actual[id.toString()], `Matching content for id: ${id}`)
  }
})

test('paginates gets', async (t) => {
  const { branch, cid } = t.context as Context
  const bulkIds = util.generateBulkIds(250)
  for (const id of bulkIds) {
    await branch.addEntry(id, cid)
  }
  const reversed = bulkIds.reverse()

  const fromStart = await branch.getEntries(75)
  t.deepEqual(
    fromStart.map((e) => e.id),
    reversed.slice(0, 75),
    'returns a slice from start of branch',
  )

  const middleSlice = await branch.getEntries(75, reversed[100])
  t.deepEqual(
    middleSlice.map((e) => e.id),
    reversed.slice(101, 176),
    'returns a slice from middle of branch',
  )

  const onEdge = await branch.getEntries(100, reversed[50])
  t.deepEqual(
    onEdge.map((e) => e.id),
    reversed.slice(51, 151),
    'returns a slice that falls on table edge',
  )

  const all = await branch.getEntries(300)
  t.deepEqual(
    all.map((e) => e.id),
    reversed,
    'returns the whole listing ',
  )
})

test('splits tables', async (t) => {
  const { branch, cid } = t.context as Context
  const ids = util.generateBulkIds(100)
  for (const id of ids) {
    await branch.addEntry(id, cid)
  }
  t.is(branch.tableCount(), 1, 'Does not split at 100 entries')

  await branch.addEntry(Timestamp.now(), cid)
  t.is(branch.tableCount(), 2, 'Does split at 101 entries')
})

test('compresses tables', async (t) => {
  const { branch, cid } = t.context as Context

  const ids = util.generateBulkIds(6401)
  const firstBatch = ids.slice(0, 400)
  const threshold = ids[400]
  const secondBatch = ids.slice(401, 6400)
  const final = ids[6400]
  for (const id of firstBatch) {
    await branch.addEntry(id, cid)
  }
  t.is(branch.tableCount(), 4, 'Does not compress at 4 tables')

  await branch.addEntry(threshold, cid)
  t.is(
    branch.tableCount(),
    2,
    'Compresses oldest 4 tables once there are 5 tables',
  )

  for (const id of secondBatch) {
    await branch.addEntry(id, cid)
  }
  t.is(
    branch.tableCount(),
    10,
    'Does not compress at any level until necessary',
  )

  await branch.addEntry(final, cid)
  t.is(
    branch.tableCount(),
    2,
    'Cascades compression of all tables to an xl table',
  )
})
