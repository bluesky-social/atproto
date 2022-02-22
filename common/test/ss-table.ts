import test from 'ava'

import SSTable, { TableSize } from '../src/user-store/ss-table.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import Timestamp from '../src/user-store/timestamp.js'

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
  const id = Timestamp.now()

  await table.addEntry(id, cid)
  t.is(await table.getEntry(id), cid, 'retrieves correct data')

  await table.editEntry(id, cid2)
  t.is(await table.getEntry(id), cid2, 'edits data')

  await table.deleteEntry(id)
  t.is(await table.getEntry(id), null, 'deletes data')
})

test('enforces uniqueness', async (t) => {
  const { table, cid } = t.context as Context
  const id = Timestamp.now()
  await table.addEntry(id, cid)
  await t.throwsAsync(
    table.addEntry(id, cid),
    { instanceOf: Error },
    'throw when adding non-unique key',
  )
})

test('bulk adds data', async (t) => {
  const { table } = t.context as Context
  const bulkIds = await util.generateBulkIdMapping(50)
  await table.addEntries(bulkIds)

  const ids = util.keysFromMapping(bulkIds)
  const allIncluded = util.checkInclusionInTable(ids, table)
  t.true(allIncluded, 'contains all added entries')
})

test('returns oldest id', async (t) => {
  const { table, cid } = t.context as Context
  const bulkIds = util.generateBulkIds(50)
  await Promise.all(bulkIds.map((id) => table.addEntry(id, cid)))
  t.deepEqual(table.oldestId(), bulkIds[0], 'returns oldest id')
})

test('loads from blockstore', async (t) => {
  const { store, table } = t.context as Context
  const bulkIds = await util.generateBulkIdMapping(50)
  await table.addEntries(bulkIds)

  const fromBS = await SSTable.get(store, table.cid)
  for (const id of Object.keys(bulkIds)) {
    t.deepEqual(
      fromBS.getEntry(Timestamp.parse(id)),
      bulkIds[id],
      `Matching content for id: ${id}`,
    )
  }
})

test('enforces max size', async (t) => {
  const { table, cid } = t.context as Context
  const bulkIds = await util.generateBulkIdMapping(100)
  await table.addEntries(bulkIds)
  t.pass('does not throw at max size')
  await t.throwsAsync(
    table.addEntry(Timestamp.now(), cid),
    { message: 'Table is full' },
    'throws when exceeding max size',
  )
})

test('merges tables', async (t) => {
  const { table, table2 } = t.context as Context
  const bulkIds = await util.generateBulkIdMapping(100, Date.now() - 1000)
  const bulkIds2 = await util.generateBulkIdMapping(100)
  await table.addEntries(bulkIds)
  await table2.addEntries(bulkIds2)

  const merged = await SSTable.merge([table, table2])

  const allIds = util.keysFromMappings([bulkIds, bulkIds2])
  const allIncluded = util.checkInclusionInTable(allIds, merged)
  t.true(allIncluded, 'contains all added entries')
  t.is(merged.size, TableSize.md, 'correctly upgrades size of table')
})

test('enforces uniqueness on merge', async (t) => {
  const { table, table2, cid } = t.context as Context
  const bulkIds = await util.generateBulkIdMapping(99, Date.now() - 1000)
  const bulkIds2 = await util.generateBulkIdMapping(99)
  const common = Timestamp.now()
  bulkIds[common.toString()] = cid
  bulkIds2[common.toString()] = cid
  await table.addEntries(bulkIds)
  await table2.addEntries(bulkIds2)

  await t.throwsAsync(
    SSTable.merge([table, table2]),
    { instanceOf: Error },
    'throw when merge conflict on non-unique key',
  )
})
