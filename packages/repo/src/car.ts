import * as cbor from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import * as varint from 'varint'
import {
  check,
  parseCidFromBytes,
  schema,
  streamToBuffer,
  verifyCidForBytes,
} from '@atproto/common'
import { BlockMap } from './block-map'
import { CarBlock } from './types'

export async function* writeCarStream(
  root: CID | null,
  blocks: AsyncIterable<CarBlock>,
): AsyncIterable<Uint8Array> {
  const header = new Uint8Array(
    cbor.encode({
      version: 1,
      roots: root ? [root] : [],
    }),
  )
  yield new Uint8Array(varint.encode(header.byteLength))
  yield header
  for await (const block of blocks) {
    yield new Uint8Array(
      varint.encode(block.cid.bytes.byteLength + block.bytes.byteLength),
    )
    yield block.cid.bytes
    yield block.bytes
  }
}

export const blocksToCarFile = (
  root: CID | null,
  blocks: BlockMap,
): Promise<Uint8Array> => {
  const carStream = blocksToCarStream(root, blocks)
  return streamToBuffer(carStream)
}

export const blocksToCarStream = (
  root: CID | null,
  blocks: BlockMap,
): AsyncIterable<Uint8Array> => {
  return writeCarStream(root, iterateBlocks(blocks))
}

async function* iterateBlocks(blocks: BlockMap) {
  for (const entry of blocks.entries()) {
    yield { cid: entry.cid, bytes: entry.bytes }
  }
}

export type ReadCarOptions = {
  /**
   * When true, does not verify CID-to-content mapping within CAR.
   */
  skipCidVerification?: boolean
}

export const readCar = async (
  bytes: Uint8Array,
  opts?: ReadCarOptions,
): Promise<{ roots: CID[]; blocks: BlockMap }> => {
  const { roots, blocks } = await readCarStream([bytes], opts)
  const blockMap = new BlockMap()
  for await (const block of blocks) {
    blockMap.set(block.cid, block.bytes)
  }
  return { roots, blocks: blockMap }
}

export const readCarWithRoot = async (
  bytes: Uint8Array,
  opts?: ReadCarOptions,
): Promise<{ root: CID; blocks: BlockMap }> => {
  const { roots, blocks } = await readCar(bytes, opts)
  if (roots.length !== 1) {
    throw new Error(`Expected one root, got ${roots.length}`)
  }
  const root = roots[0]
  return {
    root,
    blocks,
  }
}
export type CarBlockIterable = AsyncGenerator<CarBlock, void, unknown> & {
  dump: () => Promise<void>
}

export const readCarStream = async (
  car: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  opts?: ReadCarOptions,
): Promise<{
  roots: CID[]
  blocks: CarBlockIterable
}> => {
  const reader = new BufferedReader(car)
  try {
    const headerSize = await reader.readVarint()
    if (headerSize === null) {
      throw new Error('Could not parse CAR header')
    }
    const headerBytes = await reader.read(headerSize)
    const header = cbor.decode(headerBytes)
    if (!check.is(header, schema.carHeader)) {
      throw new Error('Could not parse CAR header')
    }
    return {
      roots: header.roots,
      blocks: readCarBlocksIter(reader, opts),
    }
  } catch (err) {
    await reader.close()
    throw err
  }
}

const readCarBlocksIter = (
  reader: BufferedReader,
  opts?: ReadCarOptions,
): CarBlockIterable => {
  let generator = readCarBlocksIterGenerator(reader)
  if (!opts?.skipCidVerification) {
    generator = verifyIncomingCarBlocks(generator)
  }
  return Object.assign(generator, {
    async dump() {
      // try/finally to ensure that reader.close is called even if blocks.return throws.
      try {
        // Prevent the iterator from being started after this method is called.
        await generator.return()
      } finally {
        // @NOTE the "finally" block of the async generator won't be called
        // if the iteration was never started so we need to manually close here.
        await reader.close()
      }
    },
  })
}

async function* readCarBlocksIterGenerator(
  reader: BufferedReader,
): AsyncGenerator<CarBlock, void, unknown> {
  try {
    while (!reader.isDone) {
      const blockSize = await reader.readVarint()
      if (blockSize === null) {
        break
      }
      const blockBytes = await reader.read(blockSize)
      const cid = parseCidFromBytes(blockBytes.subarray(0, 36))
      const bytes = blockBytes.subarray(36)
      yield { cid, bytes }
    }
  } finally {
    await reader.close()
  }
}

export async function* verifyIncomingCarBlocks(
  car: AsyncIterable<CarBlock>,
): AsyncGenerator<CarBlock, void, unknown> {
  for await (const block of car) {
    await verifyCidForBytes(block.cid, block.bytes)
    yield block
  }
}

class BufferedReader {
  buffer: Uint8Array = new Uint8Array()
  iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array>
  isDone = false

  constructor(stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>) {
    this.iterator =
      Symbol.asyncIterator in stream
        ? stream[Symbol.asyncIterator]()
        : stream[Symbol.iterator]()
  }

  async read(bytesToRead: number): Promise<Uint8Array> {
    await this.readUntilBuffered(bytesToRead)
    const value = this.buffer.subarray(0, bytesToRead)
    this.buffer = this.buffer.subarray(bytesToRead)
    return value
  }

  async readVarint(): Promise<number | null> {
    let done = false
    const bytes: Uint8Array[] = []
    while (!done) {
      const byte = await this.read(1)
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
    return varint.decode(concatted)
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

  async close(): Promise<void> {
    if (!this.isDone && this.iterator.return) {
      await this.iterator.return()
    }
    this.isDone = true
    this.buffer = new Uint8Array()
  }
}
