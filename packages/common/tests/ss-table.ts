import SSTable, { TableSize } from '../src/repo/ss-table'
import IpldStore from '../src/blockstore/ipld-store'
import TID from '../src/repo/tid'

import * as util from './_util'
import { CID } from 'multiformats'

describe('ss-table', () => {
  let store: IpldStore
  let table: SSTable

  it('creates table', async () => {
    store = IpldStore.createInMemory()
    table = await SSTable.create(store)
  })

  const tid = TID.next()

  it('adds data', async () => {
    const cid = await util.randomCid()
    await table.addEntry(tid, cid)
    expect(await table.getEntry(tid)).toEqual(cid)
  })

  it('edits data', async () => {
    const cid = await util.randomCid()
    await table.editEntry(tid, cid)
    expect(await table.getEntry(tid)).toEqual(cid)
  })

  it('deletes data', async () => {
    await table.deleteEntry(tid)
    expect(await table.getEntry(tid)).toEqual(null)
  })

  it('enforces uniqueness', async () => {
    const cid = await util.randomCid()
    const tid = TID.next()
    await table.addEntry(tid, cid)
    try {
      await table.addEntry(tid, cid)
      expect(false).toBeTruthy()
    } catch (err) {
      expect(err instanceof Error).toBeTruthy()
    }
  })

  let bulkTids: Record<string, CID>

  it('bulk adds data', async () => {
    bulkTids = await util.generateBulkTidMapping(50)
    await table.addEntries(bulkTids)

    const tids = util.keysFromMapping(bulkTids)
    const allIncluded = util.checkInclusionInTable(tids, table)
    expect(allIncluded).toBeTruthy()
  })

  it('loads from blockstore', async () => {
    const fromBS = await SSTable.load(store, table.cid)
    for (const tid of Object.keys(bulkTids)) {
      expect(fromBS.getEntry(TID.fromStr(tid))).toEqual(bulkTids[tid])
    }
  })

  it('enforces max size', async () => {
    const moreTids = await util.generateBulkTidMapping(50)
    await table.addEntries(moreTids)
    // does not throw at max size
    // throws when 1 over
    const cid = await util.randomCid()
    try {
      await table.addEntry(TID.next(), cid)
      expect(false).toBeTruthy()
    } catch (err) {
      expect(err instanceof Error).toBeTruthy()
    }
  })

  it('merges tables', async () => {
    const toMerge = await SSTable.create(store)
    const toMerge2 = await SSTable.create(store)
    const bulkTids = await util.generateBulkTidMapping(100)
    const bulkTids2 = await util.generateBulkTidMapping(100)
    await toMerge.addEntries(bulkTids)
    await toMerge2.addEntries(bulkTids2)

    const merged = await SSTable.merge([toMerge, toMerge2])

    const allTids = util.keysFromMappings([bulkTids, bulkTids2])
    const allIncluded = util.checkInclusionInTable(allTids, merged)
    expect(allIncluded).toBeTruthy()
    expect(merged.size).toEqual(TableSize.md)
  })

  it('enforces uniqueness on merge', async () => {
    const toMerge = await SSTable.create(store)
    const toMerge2 = await SSTable.create(store)
    const bulkTids = await util.generateBulkTidMapping(99)
    const bulkTids2 = await util.generateBulkTidMapping(99)
    const cid = await util.randomCid()
    const common = TID.next()
    bulkTids[common.toString()] = cid
    bulkTids2[common.toString()] = cid
    await toMerge.addEntries(bulkTids)
    await toMerge2.addEntries(bulkTids2)

    try {
      await SSTable.merge([toMerge, toMerge2])
      expect(false).toBeTruthy()
    } catch (err) {
      expect(err instanceof Error).toBeTruthy()
    }
  })
})
