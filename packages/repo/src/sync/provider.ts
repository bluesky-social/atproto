import { def, RecordPath } from '../types'
import { BlockWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import CidSet from '../cid-set'
import { MissingBlocksError } from '../error'
import { RepoStorage } from '../storage'
import { RepoRoot } from '../types'
import * as util from '../util'
import { MST } from '../mst'

// Checkouts
// -------------

export const getCheckout = async (
  storage: RepoStorage,
  cid: CID,
): Promise<Uint8Array> => {
  return util.writeCar(cid, async (car: BlockWriter) => {
    const root = await writeCommitAndRootToCar(storage, car, cid)
    const meta = await storage.readObjAndBytes(root.meta, def.repoMeta)
    await car.put({ cid: root.meta, bytes: meta.bytes })
    const mst = MST.load(storage, root.data)
    await mst.writeToCarStream(car)
  })
}

// Diffs
// -------------

export const getDiff = async (
  storage: RepoStorage,
  latest: CID,
  earliest: CID | null,
): Promise<Uint8Array> => {
  return util.writeCar(latest, (car: BlockWriter) => {
    return writeCommitsToCarStream(storage, car, latest, earliest)
  })
}

export const getFullRepo = async (
  storage: RepoStorage,
  cid: CID,
): Promise<Uint8Array> => {
  return getDiff(storage, cid, null)
}

export const writeCommitsToCarStream = async (
  storage: RepoStorage,
  car: BlockWriter,
  latest: CID,
  earliest: CID | null,
): Promise<void> => {
  const commits = await storage.getCommits(latest, earliest)
  if (commits === null) {
    throw new Error('Could not find shared history')
  }
  if (commits.length === 0) return
  for (const commit of commits) {
    for (const entry of commit.blocks.entries()) {
      await car.put(entry)
    }
  }
}

// Narrow slices
// -------------

export const getRecords = async (
  storage: RepoStorage,
  commit: CID,
  paths: RecordPath[],
): Promise<Uint8Array> => {
  return util.writeCar(commit, async (car: BlockWriter) => {
    const root = await writeCommitAndRootToCar(storage, car, commit)
    const mst = MST.load(storage, root.data)
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

// Helpers
// -------------

export const writeCommitAndRootToCar = async (
  storage: RepoStorage,
  car: BlockWriter,
  cid: CID,
): Promise<RepoRoot> => {
  const commit = await storage.readObjAndBytes(cid, def.commit)
  await car.put({ cid: cid, bytes: commit.bytes })
  const root = await storage.readObjAndBytes(commit.obj.root, def.repoRoot)
  await car.put({ cid: commit.obj.root, bytes: root.bytes })
  return root.obj
}
