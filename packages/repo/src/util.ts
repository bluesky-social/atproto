import { setImmediate } from 'node:timers/promises'
import { CID } from 'multiformats/cid'
import * as cbor from '@ipld/dag-cbor'
import { CarBlockIterator } from '@ipld/car/iterator'
import { BlockWriter, CarWriter } from '@ipld/car/writer'
import {
  streamToBuffer,
  verifyCidForBytes,
  cborDecode,
  check,
  schema,
  cidForCbor,
  byteIterableToStream,
  TID,
} from '@atproto/common'
import { ipldToLex, lexToIpld, LexValue, RepoRecord } from '@atproto/lexicon'

import * as crypto from '@atproto/crypto'
import DataDiff from './data-diff'
import {
  CarBlock,
  Commit,
  LegacyV2Commit,
  RecordCreateDescript,
  RecordDeleteDescript,
  RecordPath,
  RecordUpdateDescript,
  RecordWriteDescript,
  UnsignedCommit,
  WriteOpAction,
} from './types'
import BlockMap from './block-map'
import { Keypair } from '@atproto/crypto'
import { Readable } from 'stream'

export async function* verifyIncomingCarBlocks(
  car: AsyncIterable<CarBlock>,
): AsyncIterable<CarBlock> {
  for await (const block of car) {
    await verifyCidForBytes(block.cid, block.bytes)
    yield block
  }
}

// we have to turn the car writer output into a stream in order to properly handle errors
export function writeCarStream(
  root: CID | null,
  fn: (car: BlockWriter) => Promise<void>,
): Readable {
  const { writer, out } =
    root !== null ? CarWriter.create(root) : CarWriter.create()

  const stream = byteIterableToStream(out)
  fn(writer)
    .catch((err) => {
      stream.destroy(err)
    })
    .finally(() => writer.close())
  return stream
}

export async function* writeCar(
  root: CID | null,
  fn: (car: BlockWriter) => Promise<void>,
): AsyncIterable<Uint8Array> {
  const stream = writeCarStream(root, fn)
  for await (const chunk of stream) {
    yield chunk
  }
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

export const carToBlocks = async (
  car: CarBlockIterator,
): Promise<{ roots: CID[]; blocks: BlockMap }> => {
  const roots = await car.getRoots()
  const blocks = new BlockMap()
  for await (const block of verifyIncomingCarBlocks(car)) {
    blocks.set(block.cid, block.bytes)
    // break up otherwise "synchronous" work in car parsing
    await setImmediate()
  }
  return {
    roots,
    blocks,
  }
}

export const readCar = async (
  bytes: Uint8Array,
): Promise<{ roots: CID[]; blocks: BlockMap }> => {
  const car = await CarBlockIterator.fromBytes(bytes)
  return carToBlocks(car)
}

export const readCarStream = async (stream: AsyncIterable<Uint8Array>) => {
  const car = await CarBlockIterator.fromIterable(stream)
  return carToBlocks(car)
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

export const diffToWriteDescripts = (
  diff: DataDiff,
): Promise<RecordWriteDescript[]> => {
  return Promise.all([
    ...diff.addList().map(async (add) => {
      const { collection, rkey } = parseDataKey(add.key)
      return {
        action: WriteOpAction.Create,
        collection,
        rkey,
        cid: add.cid,
      } as RecordCreateDescript
    }),
    ...diff.updateList().map(async (upd) => {
      const { collection, rkey } = parseDataKey(upd.key)
      return {
        action: WriteOpAction.Update,
        collection,
        rkey,
        cid: upd.cid,
        prev: upd.prev,
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

export const ensureCreates = (
  descripts: RecordWriteDescript[],
): RecordCreateDescript[] => {
  const creates: RecordCreateDescript[] = []
  for (const descript of descripts) {
    if (descript.action !== WriteOpAction.Create) {
      throw new Error(`Unexpected action: ${descript.action}`)
    } else {
      creates.push(descript)
    }
  }
  return creates
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

export const ensureV3Commit = (commit: LegacyV2Commit | Commit): Commit => {
  if (commit.version === 3) {
    return commit
  } else {
    return {
      ...commit,
      version: 3,
      rev: commit.rev ?? TID.nextStr(),
    }
  }
}
