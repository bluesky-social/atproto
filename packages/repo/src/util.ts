import { CID } from 'multiformats/cid'
import * as cbor from '@ipld/dag-cbor'
import { CarReader } from '@ipld/car/reader'
import { BlockWriter, CarWriter } from '@ipld/car/writer'
import { Block as CarBlock } from '@ipld/car/api'
import {
  streamToBuffer,
  verifyCidForBytes,
  cborDecode,
  check,
  schema,
  cidForCbor,
} from '@atproto/common'
import { ipldToLex, lexToIpld, LexValue, RepoRecord } from '@atproto/lexicon'

import * as crypto from '@atproto/crypto'
import Repo from './repo'
import { MST } from './mst'
import DataDiff from './data-diff'
import { RepoStorage } from './storage'
import {
  Commit,
  RecordCreateDescript,
  RecordDeleteDescript,
  RecordPath,
  RecordUpdateDescript,
  RecordWriteDescript,
  UnsignedCommit,
  WriteLog,
  WriteOpAction,
} from './types'
import BlockMap from './block-map'
import { MissingBlocksError } from './error'
import * as parse from './parse'
import { Keypair } from '@atproto/crypto'

export async function* verifyIncomingCarBlocks(
  car: AsyncIterable<CarBlock>,
): AsyncIterable<CarBlock> {
  for await (const block of car) {
    await verifyCidForBytes(block.cid, block.bytes)
    yield block
  }
}

export const writeCar = (
  root: CID | null,
  fn: (car: BlockWriter) => Promise<void>,
): AsyncIterable<Uint8Array> => {
  const { writer, out } =
    root !== null ? CarWriter.create(root) : CarWriter.create()

  fn(writer).finally(() => writer.close())

  return out
}

export const blocksToCarStream = (
  root: CID | null,
  blocks: BlockMap,
): AsyncIterable<Uint8Array> => {
  return writeCar(root, async (writer) => {
    for (const entry of blocks.entries()) {
      await writer.put(entry)
    }
  })
}

export const blocksToCarFile = (
  root: CID | null,
  blocks: BlockMap,
): Promise<Uint8Array> => {
  const carStream = blocksToCarStream(root, blocks)
  return streamToBuffer(carStream)
}

export const readCar = async (
  bytes: Uint8Array,
): Promise<{ roots: CID[]; blocks: BlockMap }> => {
  const car = await CarReader.fromBytes(bytes)
  const roots = await car.getRoots()
  const blocks = new BlockMap()
  for await (const block of verifyIncomingCarBlocks(car.blocks())) {
    await blocks.set(block.cid, block.bytes)
  }
  return {
    roots,
    blocks,
  }
}

export const readCarWithRoot = async (
  bytes: Uint8Array,
): Promise<{ root: CID; blocks: BlockMap }> => {
  const { roots, blocks } = await readCar(bytes)
  if (roots.length !== 1) {
    throw new Error(`Expected one root, got ${roots.length}`)
  }
  const root = roots[0]
  return {
    root,
    blocks,
  }
}

export const getWriteLog = async (
  storage: RepoStorage,
  latest: CID,
  earliest: CID | null,
): Promise<WriteLog> => {
  const commits = await storage.getCommitPath(latest, earliest)
  if (!commits) throw new Error('Could not find shared history')
  const heads = await Promise.all(commits.map((c) => Repo.load(storage, c)))
  // Turn commit path into list of diffs
  let prev = await MST.create(storage) // Empty
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
    diffs.map((diff) => diffToWriteDescripts(diff, diffBlocks.blocks)),
  )
}

export const diffToWriteDescripts = (
  diff: DataDiff,
  blocks: BlockMap,
): Promise<RecordWriteDescript[]> => {
  return Promise.all([
    ...diff.addList().map(async (add) => {
      const { collection, rkey } = parseDataKey(add.key)
      const value = await parse.getAndParseRecord(blocks, add.cid)
      return {
        action: WriteOpAction.Create,
        collection,
        rkey,
        cid: add.cid,
        record: value.record,
      } as RecordCreateDescript
    }),
    ...diff.updateList().map(async (upd) => {
      const { collection, rkey } = parseDataKey(upd.key)
      const value = await parse.getAndParseRecord(blocks, upd.cid)
      return {
        action: WriteOpAction.Update,
        collection,
        rkey,
        cid: upd.cid,
        prev: upd.prev,
        record: value.record,
      } as RecordUpdateDescript
    }),
    ...diff.deleteList().map((del) => {
      const { collection, rkey } = parseDataKey(del.key)
      return {
        action: WriteOpAction.Delete,
        collection,
        rkey,
        cid: del.cid,
      } as RecordDeleteDescript
    }),
  ])
}

export const collapseWriteLog = (log: WriteLog): RecordWriteDescript[] => {
  const creates: Record<string, RecordCreateDescript> = {}
  const updates: Record<string, RecordUpdateDescript> = {}
  const deletes: Record<string, RecordDeleteDescript> = {}
  for (const commit of log) {
    for (const op of commit) {
      const key = op.collection + '/' + op.rkey
      if (op.action === WriteOpAction.Create) {
        const del = deletes[key]
        if (del) {
          if (del.cid !== op.cid) {
            updates[key] = {
              ...op,
              action: WriteOpAction.Update,
              prev: del.cid,
            }
          }
          delete deletes[key]
        } else {
          creates[key] = op
        }
      } else if (op.action === WriteOpAction.Update) {
        updates[key] = op
        delete creates[key]
        delete deletes[key]
      } else if (op.action === WriteOpAction.Delete) {
        if (creates[key]) {
          delete creates[key]
        } else {
          delete updates[key]
          deletes[key] = op
        }
      } else {
        throw new Error(`unknown action: ${op}`)
      }
    }
  }
  return [
    ...Object.values(creates),
    ...Object.values(updates),
    ...Object.values(deletes),
  ]
}

export const collapseDiffs = (diffs: DataDiff[]): DataDiff => {
  return diffs.reduce((acc, cur) => {
    acc.addDiff(cur)
    return acc
  }, new DataDiff())
}

export const parseDataKey = (key: string): RecordPath => {
  const parts = key.split('/')
  if (parts.length !== 2) throw new Error(`Invalid record key: ${key}`)
  return { collection: parts[0], rkey: parts[1] }
}

export const formatDataKey = (collection: string, rkey: string): string => {
  return collection + '/' + rkey
}

export const metaEqual = (a: Commit, b: Commit): boolean => {
  return a.did === b.did && a.version === b.version
}

export const signCommit = async (
  unsigned: UnsignedCommit,
  keypair: Keypair,
): Promise<Commit> => {
  const encoded = cbor.encode(unsigned)
  const sig = await keypair.sign(encoded)
  return {
    ...unsigned,
    sig,
  }
}

export const verifyCommitSig = async (
  commit: Commit,
  didKey: string,
): Promise<boolean> => {
  const { sig, ...rest } = commit
  const encoded = cbor.encode(rest)
  return crypto.verifySignature(didKey, encoded, sig)
}

export const cborToLex = (val: Uint8Array): LexValue => {
  return ipldToLex(cborDecode(val))
}

export const cborToLexRecord = (val: Uint8Array): RepoRecord => {
  const parsed = cborToLex(val)
  if (!check.is(parsed, schema.map)) {
    throw new Error('lexicon records be a json object')
  }
  return parsed
}

export const cidForRecord = async (val: LexValue) => {
  return cidForCbor(lexToIpld(val))
}
