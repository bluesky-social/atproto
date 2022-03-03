import test from 'ava'

import SSTable, { TableSize } from '../src/user-store/ss-table.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import TID from '../src/user-store/tid.js'

import * as util from './_util.js'
import { CID } from 'multiformats'

type Context = {
  store: IpldStore
  table: SSTable
  table2: SSTable
  cid: CID
  cid2: CID
}

test.beforeEach(async (t) => {
  const store = IpldStore.createInMemory()
  const table = await SSTable.create(store)
  const table2 = await SSTable.create(store)
  const cid = await util.randomCid()
  const cid2 = await util.randomCid()
  t.context = { store, table, table2, cid, cid2 } as Context
  t.pass('Context setup')
})

test('basic operations', async (t) => {
  const { table, cid, cid2 } = t.context as Context
  const tid = TID.next()

  await table.addEntry(tid, cid)
  t.is(await table.getEntry(tid), cid, 'retrieves correct data')

  await table.editEntry(tid, cid2)
  t.is(await table.getEntry(tid), cid2, 'edits data')

  await table.deleteEntry(tid)
  t.is(await table.getEntry(tid), null, 'deletes data')
})

test('enforces uniqueness', async (t) => {
  const { table, cid } = t.context as Context
  const tid = TID.next()
  await table.addEntry(tid, cid)
  await t.throwsAsync(
    table.addEntry(tid, cid),
    { instanceOf: Error },
    'throw when adding non-unique key',
  )
})

test('bulk adds data', async (t) => {
  const { table } = t.context as Context
  const bulkTids = await util.generateBulkTidMapping(50)
  await table.addEntries(bulkTids)

  const tids = util.keysFromMapping(bulkTids)
  const allIncluded = util.checkInclusionInTable(tids, table)
  t.true(allIncluded, 'contains all added entries')
})

test('returns oldest id', async (t) => {
  const { table, cid } = t.context as Context
  const bulkTids = util.generateBulkTids(50)
  await Promise.all(bulkTids.map((tid) => table.addEntry(tid, cid)))
  t.deepEqual(table.oldestTid(), bulkTids[0], 'returns oldest tid')
})

test('loads from blockstore', async (t) => {
  const { store, table } = t.context as Context
  const bulkTids = await util.generateBulkTidMapping(50)
  await table.addEntries(bulkTids)

  const fromBS = await SSTable.load(store, table.cid)
  for (const tid of Object.keys(bulkTids)) {
    t.deepEqual(
      fromBS.getEntry(TID.fromStr(tid)),
      bulkTids[tid],
      `Matching content for id: ${tid}`,
    )
  }
})

test('enforces max size', async (t) => {
  const { table, cid } = t.context as Context
  const bulkTids = await util.generateBulkTidMapping(100)
  await table.addEntries(bulkTids)
  t.pass('does not throw at max size')
  await t.throwsAsync(
    table.addEntry(TID.next(), cid),
    { message: 'Table is full' },
    'throws when exceeding max size',
  )
})

test('merges tables', async (t) => {
  const { table, table2 } = t.context as Context
  const bulkTids = await util.generateBulkTidMapping(100)
  const bulkTids2 = await util.generateBulkTidMapping(100)
  await table.addEntries(bulkTids)
  await table2.addEntries(bulkTids2)

  const merged = await SSTable.merge([table, table2])

  const allTids = util.keysFromMappings([bulkTids, bulkTids2])
  const allIncluded = util.checkInclusionInTable(allTids, merged)
  t.true(allIncluded, 'contains all added entries')
  t.is(merged.size, TableSize.md, 'correctly upgrades size of table')
})

test('enforces uniqueness on merge', async (t) => {
  const { table, table2, cid } = t.context as Context
  const bulkTids = await util.generateBulkTidMapping(99)
  const bulkTids2 = await util.generateBulkTidMapping(99)
  const common = TID.next()
  bulkTids[common.toString()] = cid
  bulkTids2[common.toString()] = cid
  await table.addEntries(bulkTids)
  await table2.addEntries(bulkTids2)

  await t.throwsAsync(
    SSTable.merge([table, table2]),
    { instanceOf: Error },
    'throw when merge conflict on non-unique key',
  )
})
