import { CID } from 'multiformats/cid'
import { CarReader } from '@ipld/car/reader'
import { BlockWriter, CarWriter } from '@ipld/car/writer'
import { Block as CarBlock } from '@ipld/car/api'
import { def, streamToArray, verifyCidForBytes } from '@atproto/common'
import Repo from './repo'
import { MST } from './mst'
import DataDiff from './data-diff'
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
import { MissingBlocksError } from './error'
import * as parse from './parse'

export async function* verifyIncomingCarBlocks(
  car: AsyncIterable<CarBlock>,
): AsyncIterable<CarBlock> {
  for await (const block of car) {
    await verifyCidForBytes(block.cid, block.bytes)
    yield block
  }
}

export const writeCar = async (
  root: CID,
  fn: (car: BlockWriter) => Promise<void>,
): Promise<Uint8Array> => {
  const { writer, out } = CarWriter.create(root)
  const bytes = streamToArray(out)
  try {
    await fn(writer)
  } finally {
    writer.close()
  }
  return bytes
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
    diffs.push(await DataDiff.of(mst, prev))
    prev = mst
  }
  const fullDiff = collapseDiffs(diffs)
  const diffBlocks = await storage.getBlocks(fullDiff.newCidList())
  if (diffBlocks.missing.length > 0) {
    throw new MissingBlocksError('write op log', diffBlocks.missing)
  }
  // Map MST diffs to write ops
  return Promise.all(
    diffs.map((diff) => diffToWriteOps(diff, diffBlocks.blocks)),
  )
}

export const diffToWriteOps = (
  diff: DataDiff,
  blocks: BlockMap,
): Promise<RecordWriteOp[]> => {
  return Promise.all([
    ...diff.addList().map(async (add) => {
      const { collection, rkey } = parseRecordKey(add.key)
      const value = await parse.getAndParse(blocks, add.cid, def.record)
      return {
        action: WriteOpAction.Create,
        collection,
        rkey,
        value: value.obj,
      } as RecordCreateOp
    }),
    ...diff.updateList().map(async (upd) => {
      const { collection, rkey } = parseRecordKey(upd.key)
      const value = await parse.getAndParse(blocks, upd.cid, def.record)
      return {
        action: WriteOpAction.Update,
        collection,
        rkey,
        value: value.obj,
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

export const parseRecordKey = (key: string) => {
  const parts = key.split('/')
  if (parts.length !== 2) throw new Error(`Invalid record key: ${key}`)
  return { collection: parts[0], rkey: parts[1] }
}
