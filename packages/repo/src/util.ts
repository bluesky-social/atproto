import { CID } from 'multiformats/cid'
import { CarReader } from '@ipld/car/reader'
import { Block as CarBlock } from '@ipld/car/api'
import {
  check,
  def,
  ipldBytesToValue,
  verifyCidForCborBytes,
} from '@atproto/common'
import Repo from './repo'
import { DataDiff, MST } from './mst'
import { RepoStorage } from './storage'
import {
  DataStore,
  RecordCreateOp,
  RecordDeleteOp,
  RecordUpdateOp,
  RecordWriteOp,
  WriteOpAction,
} from './types'
import BlockMap from './block-map'

export async function* verifyIncomingCarBlocks(
  car: AsyncIterable<CarBlock>,
): AsyncIterable<CarBlock> {
  for await (const block of car) {
    await verifyCidForCborBytes(block.cid, block.bytes)
    yield block
  }
}

export const readCar = async (
  bytes: Uint8Array,
): Promise<{ root: CID; blocks: BlockMap }> => {
  const car = await CarReader.fromBytes(bytes)
  const roots = await car.getRoots()
  if (roots.length !== 1) {
    throw new Error(`Expected one root, got ${roots.length}`)
  }
  const root = roots[0]
  const blocks = new BlockMap()
  for await (const block of verifyIncomingCarBlocks(car.blocks())) {
    await blocks.set(block.cid, block.bytes)
  }
  return {
    root,
    blocks,
  }
}

export const getWriteOpLog = async (
  storage: RepoStorage,
  latest: CID,
  earliest: CID | null,
): Promise<RecordWriteOp[][]> => {
  const commits = await storage.getCommitPath(latest, earliest)
  if (!commits) throw new Error('Could not find shared history')
  const heads = await Promise.all(commits.map((c) => Repo.load(storage, c)))
  // Turn commit path into list of diffs
  let prev: DataStore = await MST.create(storage) // Empty
  const msts = heads.map((h) => h.data)
  const diffs: DataDiff[] = []
  for (const mst of msts) {
    diffs.push(await prev.diff(mst))
    prev = mst
  }
  const fullDiff = collapseDiffs(diffs)
  const diffBlocks = await storage.getBlocks(fullDiff.newCidList())
  // Map MST diffs to write ops
  return Promise.all(diffs.map((diff) => diffToWriteOps(diff, diffBlocks)))
}

export const diffToWriteOps = (
  diff: DataDiff,
  blocks: BlockMap,
): Promise<RecordWriteOp[]> => {
  return Promise.all([
    ...diff.addList().map(async (add) => {
      const { collection, rkey } = parseRecordKey(add.key)
      const value = await getAndParse(blocks, add.cid, def.record)
      return {
        action: WriteOpAction.Create,
        collection,
        rkey,
        value,
      } as RecordCreateOp
    }),
    ...diff.updateList().map(async (upd) => {
      const { collection, rkey } = parseRecordKey(upd.key)
      const value = await getAndParse(blocks, upd.cid, def.record)
      return {
        action: WriteOpAction.Update,
        collection,
        rkey,
        value,
      } as RecordUpdateOp
    }),
    ...diff.deleteList().map((del) => {
      const { collection, rkey } = parseRecordKey(del.key)
      return {
        action: WriteOpAction.Delete,
        collection,
        rkey,
      } as RecordDeleteOp
    }),
  ])
}

export const collapseDiffs = (diffs: DataDiff[]): DataDiff => {
  return diffs.reduce((acc, cur) => {
    acc.addDiff(cur)
    return acc
  }, new DataDiff())
}

export const getAndParse = async <T>(
  blocks: BlockMap,
  cid: CID,
  schema: check.Def<T>,
): Promise<T> => {
  const bytes = blocks.get(cid)
  if (!bytes) {
    throw new Error(`Not found: ${cid.toString()}`)
  }
  const obj = await ipldBytesToValue(bytes)
  if (!check.is(obj, schema)) {
    throw new Error(`Did not find expected object at ${cid.toString()}`)
  }
  return obj
}

export const parseRecordKey = (key: string) => {
  const parts = key.split('/')
  if (parts.length !== 2) throw new Error(`Invalid record key: ${key}`)
  return { collection: parts[0], rkey: parts[1] }
}
