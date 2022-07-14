import { CID } from 'multiformats'

import TidCollection from '../src/repo/tid-collection'
import IpldStore from '../src/blockstore/ipld-store'
import TID from '../src/repo/tid'
import * as util from './_util'
import { IdMapping } from '../src/repo/types'

describe('tid-collection', () => {
  let store: IpldStore
  let collection: TidCollection

  it('is created', async () => {
    store = IpldStore.createInMemory()
    collection = await TidCollection.create(store)
  })

  const tids = util.generateBulkTids(250)
  const middleTid = tids[125]
  let middleCid: CID

  it('adds data', async () => {
    for (const tid of tids) {
      const cid = await util.randomCid()
      await collection.addEntry(tid, cid)
      if (tid.equals(middleTid)) {
        middleCid = cid
      }
    }
  })

  it('retrieves correct data', async () => {
    expect(await collection.getEntry(middleTid)).toEqual(middleCid)
  })

  it('edits data', async () => {
    const newCid = await util.randomCid()
    await collection.editEntry(middleTid, newCid)
    expect(await collection.getEntry(middleTid)).toEqual(newCid)
  })

  it('deletes data', async () => {
    await collection.deleteEntry(middleTid)
    expect(await collection.getEntry(middleTid)).toEqual(null)
  })

  // Commented out because this test takes a long time, and we're redoing this data structure soon

  // it('loads from blockstore', async () => {
  //   collection = await TidCollection.create(store)
  //   const bulkTids = util.generateBulkTids(450)
  //   const actual = {} as IdMapping
  //   for (const tid of bulkTids) {
  //     const cid = await util.randomCid()
  //     await collection.addEntry(tid, cid)
  //     actual[tid.toString()] = cid
  //   }

  //   const loaded = await TidCollection.load(store, collection.cid)
  //   for (const tid of bulkTids) {
  //     const got = await loaded.getEntry(tid)
  //     expect(got).toEqual(actual[tid.toString()])
  //   }
  // })

  it('splits tables', async () => {
    collection = await TidCollection.create(store)
    const tids = util.generateBulkTids(100)
    const cid = await util.randomCid()
    for (const tid of tids) {
      await collection.addEntry(tid, cid)
    }
    expect(collection.tableCount()).toEqual(1)
    await collection.addEntry(TID.next(), cid)
    expect(collection.tableCount()).toEqual(2)
  })

  it('paginates gets', async () => {
    collection = await TidCollection.create(store)
    const cid = await util.randomCid()
    const bulkTids = util.generateBulkTids(250)
    for (const tid of bulkTids) {
      await collection.addEntry(tid, cid)
    }
    const reversed = bulkTids.reverse()

    const fromStart = await collection.getEntries(75)
    expect(fromStart.map((e) => e.tid)).toEqual(reversed.slice(0, 75))

    const middleSlice = await collection.getEntries(75, reversed[100])
    expect(middleSlice.map((e) => e.tid)).toEqual(reversed.slice(101, 176))

    const onEdge = await collection.getEntries(100, reversed[50])
    expect(onEdge.map((e) => e.tid)).toEqual(reversed.slice(51, 151))

    const all = await collection.getEntries(300)
    expect(all.map((e) => e.tid)).toEqual(reversed)
  })

  // Commented out because this test takes a long time, and we're redoing this data structure soon

  // it('compresses tables', async () => {
  //   collection = await TidCollection.create(store)
  //   const cid = await util.randomCid()
  //   const tids = util.generateBulkTids(6401)
  //   const firstBatch = tids.slice(0, 400)
  //   const threshold = tids[400]
  //   const secondBatch = tids.slice(401, 6400)
  //   const final = tids[6400]
  //   for (const tid of firstBatch) {
  //     await collection.addEntry(tid, cid)
  //   }
  //   expect(collection.tableCount()).toBe(4)

  //   await collection.addEntry(threshold, cid)
  //   expect(collection.tableCount()).toBe(2)

  //   for (const tid of secondBatch) {
  //     await collection.addEntry(tid, cid)
  //   }
  //   expect(collection.tableCount()).toBe(10)

  //   await collection.addEntry(final, cid)
  //   expect(collection.tableCount()).toBe(2)
  // })
})
