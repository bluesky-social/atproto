import * as stream from 'node:stream'
import * as cbor from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { decode as varintDecode, encode as varintEncode } from 'varint'
// import * as varintLib from 'varint'
import {
  TID,
  byteIterableToStream,
  cborDecode,
  check,
  cidForCbor,
  schema,
  sha256ToCid,
  streamToBuffer,
  verifyCidForBytes,
} from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { Keypair } from '@atproto/crypto'
import { LexValue, RepoRecord, ipldToLex, lexToIpld } from '@atproto/lexicon'
import { BlockMap } from './block-map'
import { DataDiff } from './data-diff'
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

export async function* verifyIncomingCarBlocks(
  car: AsyncIterable<CarBlock>,
): AsyncIterable<CarBlock> {
  for await (const block of car) {
    await verifyCidForBytes(block.cid, block.bytes)
    yield block
  }
}

export function writeCarStream(
  root: CID | null,
  blocks: AsyncIterable<{ cid: CID; bytes: Uint8Array }>,
): stream.Readable {
  const iter = writeCar(root, blocks)
  return byteIterableToStream(iter)
}

export async function* writeCar(
  root: CID | null,
  blocks: AsyncIterable<{ cid: CID; bytes: Uint8Array }>,
): AsyncIterable<Uint8Array> {
  const header = new Uint8Array(
    cbor.encode({
      version: 1,
      roots: root ? [root] : [],
    }),
  )
  yield varint(header.byteLength)
  yield header
  for await (const block of blocks) {
    yield varint(block.cid.bytes.byteLength + block.bytes.byteLength)
    yield block.cid.bytes
    yield block.bytes
  }
}

function varint(n: number) {
  return new Uint8Array(varintEncode(n))
}

export const blocksToCarStream = (
  root: CID | null,
  blocks: BlockMap,
): AsyncIterable<Uint8Array> => {
  return writeCar(root, iterateBlocks(blocks))
}

async function* iterateBlocks(blocks: BlockMap) {
  for (const entry of blocks.entries()) {
    yield { cid: entry.cid, bytes: entry.bytes }
  }
}

export const readCar = async (
  bytes: Uint8Array,
): Promise<{ roots: CID[]; blocks: BlockMap }> => {
  const { roots, blocks } = await readCarStream(bytesToIterable(bytes))
  const blockMap = new BlockMap()
  for await (const block of blocks) {
    blockMap.set(block.cid, block.bytes)
  }
  return { roots, blocks: blockMap }
}

async function* bytesToIterable(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield bytes
}

export const readCarStream = async (
  car: AsyncIterable<Uint8Array>,
): Promise<{
  roots: CID[]
  blocks: AsyncIterable<{ cid: CID; bytes: Uint8Array }>
}> => {
  const reader = new BufferedReader(car)
  const headerSize = await readVarint(reader)
  if (headerSize === null) {
    throw new Error('could not parse car header')
  }
  const headerBytes = await reader.read(headerSize)
  const header = cbor.decode(headerBytes)
  if (!check.is(header, schema.carHeader)) {
    throw new Error('could not parse car header')
  }
  const roots = header.roots
  const blocks = readCarBlocksIter(reader)
  return { roots, blocks }
}

async function* readCarBlocksIter(
  reader: BufferedReader,
): AsyncIterable<{ cid: CID; bytes: Uint8Array }> {
  while (!reader.isDone) {
    const blockSize = await readVarint(reader)
    if (blockSize === null) {
      break
    }
    const blockBytes = await reader.read(blockSize)
    const cid = parseDaslCid(blockBytes.slice(0, 36))
    const bytes = blockBytes.slice(36)
    yield { cid, bytes }
  }
}

const parseDaslCid = (cidBytes: Uint8Array): CID => {
  const version = cidBytes[0]
  if (version !== 0x01) {
    throw new Error('version')
  }
  const codec = cidBytes[1]
  if (codec !== 0x55 && codec !== 0x71) {
    throw new Error('codec')
  }
  const hashType = cidBytes[2]
  if (hashType !== 0x12) {
    throw new Error('hashType')
  }
  const hashLength = cidBytes[3]
  const rest = cidBytes.slice(4)
  if (rest.byteLength < hashLength) {
    throw new Error('hash length')
  }
  return sha256ToCid(rest, codec)
}

const readVarint = async (reader: BufferedReader): Promise<number | null> => {
  let done = false
  const bytes: Uint8Array[] = []
  while (!done) {
    const byte = await reader.read(1)
    if (byte.byteLength === 0) {
      if (bytes.length > 0) {
        throw new Error('could not parse varint')
      } else {
        return null
      }
    }
    bytes.push(byte)
    if (byte[0] < 128) {
      done = true
    }
  }
  const concatted = ui8.concat(bytes)
  return varintDecode(concatted)
}

export class BufferedReader {
  buffer: Uint8Array = new Uint8Array()
  iterator: AsyncIterator<Uint8Array>
  isDone = false

  constructor(stream: AsyncIterable<Uint8Array>) {
    this.iterator = stream[Symbol.asyncIterator]()
  }

  async read(bytesToRead: number): Promise<Uint8Array> {
    await this.readUntilBuffered(bytesToRead)
    const value = this.buffer.slice(0, bytesToRead)
    this.buffer = this.buffer.slice(bytesToRead)
    return value
  }

  private async readUntilBuffered(bytesToRead: number) {
    if (this.isDone) {
      return
    }
    while (this.buffer.length < bytesToRead) {
      const next = await this.iterator.next()
      if (next.done) {
        this.isDone = true
        return
      }
      this.buffer = ui8.concat([this.buffer, next.value])
    }
  }
}

export const blocksToCarFile = (
  root: CID | null,
  blocks: BlockMap,
): Promise<Uint8Array> => {
  const carStream = blocksToCarStream(root, blocks)
  return streamToBuffer(carStream)
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
