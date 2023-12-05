import { def, RecordPath } from '../types'
import { BlockWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import CidSet from '../cid-set'
import { MissingBlocksError } from '../error'
import { ReadableBlockstore, RepoStorage } from '../storage'
import * as util from '../util'
import { MST } from '../mst'

// Full Repo
// -------------

export const getFullRepo = (
  storage: RepoStorage,
  commitCid: CID,
): AsyncIterable<Uint8Array> => {
  return util.writeCar(commitCid, async (car: BlockWriter) => {
    const commit = await storage.readObjAndBytes(commitCid, def.commit)
    await car.put({ cid: commitCid, bytes: commit.bytes })
    const mst = MST.load(storage, commit.obj.data)
    await mst.writeToCarStream(car)
  })
}

// Narrow slices
// -------------

export const getRecords = (
  storage: ReadableBlockstore,
  commitCid: CID,
  paths: RecordPath[],
): AsyncIterable<Uint8Array> => {
  return util.writeCar(commitCid, async (car: BlockWriter) => {
    const commit = await storage.readObjAndBytes(commitCid, def.commit)
    await car.put({ cid: commitCid, bytes: commit.bytes })
    const mst = MST.load(storage, commit.obj.data)
    const cidsForPaths = await Promise.all(
      paths.map((p) =>
        mst.cidsForPath(util.formatDataKey(p.collection, p.rkey)),
      ),
    )
    const allCids = cidsForPaths.reduce((acc, cur) => {
      return acc.addSet(new CidSet(cur))
    }, new CidSet())
    const found = await storage.getBlocks(allCids.toList())
    if (found.missing.length > 0) {
      throw new MissingBlocksError('writeRecordsToCarStream', found.missing)
    }
    for (const block of found.blocks.entries()) {
      await car.put(block)
    }
  })
}
