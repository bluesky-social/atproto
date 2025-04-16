import { CID } from 'multiformats/cid'
import { writeCarStream } from '../car'
import { CidSet } from '../cid-set'
import { MissingBlocksError } from '../error'
import { MST } from '../mst'
import { ReadableBlockstore, RepoStorage } from '../storage'
import { RecordPath, def } from '../types'
import * as util from '../util'

// Full Repo
// -------------

export const getFullRepo = (
  storage: RepoStorage,
  commitCid: CID,
): AsyncIterable<Uint8Array> => {
  return writeCarStream(commitCid, iterateFullRepo(storage, commitCid))
}

async function* iterateFullRepo(storage: RepoStorage, commitCid: CID) {
  const commit = await storage.readObjAndBytes(commitCid, def.commit)
  yield { cid: commitCid, bytes: commit.bytes }
  const mst = MST.load(storage, commit.obj.data)
  for await (const block of mst.carBlockStream()) {
    yield block
  }
}

// Narrow slices
// -------------

export const getRecords = (
  storage: ReadableBlockstore,
  commitCid: CID,
  paths: RecordPath[],
): AsyncIterable<Uint8Array> => {
  return writeCarStream(
    commitCid,
    iterateRecordBlocks(storage, commitCid, paths),
  )
}

async function* iterateRecordBlocks(
  storage: ReadableBlockstore,
  commitCid: CID,
  paths: RecordPath[],
) {
  const commit = await storage.readObjAndBytes(commitCid, def.commit)
  yield { cid: commitCid, bytes: commit.bytes }
  const mst = MST.load(storage, commit.obj.data)
  const cidsForPaths = await Promise.all(
    paths.map((p) => mst.cidsForPath(util.formatDataKey(p.collection, p.rkey))),
  )
  const allCids = cidsForPaths.reduce((acc, cur) => {
    return acc.addSet(new CidSet(cur))
  }, new CidSet())
  const found = await storage.getBlocks(allCids.toList())
  if (found.missing.length > 0) {
    throw new MissingBlocksError('writeRecordsToCarStream', found.missing)
  }
  for (const block of found.blocks.entries()) {
    yield block
  }
}
