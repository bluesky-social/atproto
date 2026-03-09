import { setImmediate } from 'node:timers/promises'
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
  const { roots, blocks } = await readCarReader(new Ui8Reader(bytes), opts)
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
  return readCarReader(new BufferedReader(car), opts)
}

export const readCarReader = async (
  reader: BytesReader,
  opts?: ReadCarOptions,
): Promise<{
  roots: CID[]
  blocks: CarBlockIterable
}> => {
  try {
    const headerSize = await readVarint(reader)
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
  reader: BytesReader,
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
  reader: BytesReader,
): AsyncGenerator<CarBlock, void, unknown> {
  let blocks = 0
  try {
    while (!reader.isDone) {
      const blockSize = await readVarint(reader)
      if (blockSize === null) {
        break
      }
      const blockBytes = await reader.read(blockSize)
      const cid = parseCidFromBytes(blockBytes.subarray(0, 36))
      const bytes = blockBytes.subarray(36)
      yield { cid, bytes }

      // yield to the event loop every 25 blocks
      // in the case the incoming CAR is synchronous, this can end up jamming up the thread
      blocks++
      if (blocks % 25 === 0) {
        await setImmediate()
      }
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

const readVarint = async (reader: BytesReader): Promise<number | null> => {
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
  return varint.decode(concatted)
}

interface BytesReader {
  isDone: boolean
  read(bytesToRead: number): Promise<Uint8Array>
  close(): Promise<void>
}

class Ui8Reader implements BytesReader {
  idx = 0
  isDone = false

  constructor(public bytes: Uint8Array) {}

  async read(bytesToRead: number): Promise<Uint8Array> {
    const value = this.bytes.subarray(this.idx, this.idx + bytesToRead)
    this.idx += bytesToRead
    if (this.idx >= this.bytes.length) {
      this.isDone = true
    }
    return value
  }

  async close(): Promise<void> {}
}

class BufferedReader implements BytesReader {
  iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array>
  isDone = false

  // @NOTE Ideally, this would be based on a fifo double linked list.
  private chunks: Uint8Array[] = []

  /** Number of bytes in chunks[0] that were already consumed */
  private alreadyRead = 0

  /** Total bytes in  */
  private chunksByteLength = 0

  constructor(stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>) {
    this.iterator =
      Symbol.asyncIterator in stream
        ? stream[Symbol.asyncIterator]()
        : stream[Symbol.iterator]()
  }

  get availableByteLength() {
    return this.chunksByteLength - this.alreadyRead
  }

  async read(bytesToRead: number): Promise<Uint8Array> {
    await this.readUntilBuffered(bytesToRead)

    const valueLength = Math.min(bytesToRead, this.availableByteLength)
    if (valueLength <= 0) return new Uint8Array()

    const firstChunk = this.chunks[0]!
    const firstChunkOffset = firstChunk.byteOffset + this.alreadyRead
    const firstChunkEnd = this.alreadyRead + valueLength // /!\ value id unbound

    // If the data to be read is less or equal to the remaining bytes in the
    // first chunk, return a sub array of that chunk.
    if (firstChunkEnd < firstChunk.byteLength) {
      // read less than first chunk
      this.alreadyRead += valueLength
      return new Uint8Array(firstChunk.buffer, firstChunkOffset, valueLength)
    } else if (firstChunkEnd === firstChunk.byteLength) {
      // read exactly first chunk (and discard it)
      this.discardFirstChunk()
      return new Uint8Array(firstChunk.buffer, firstChunkOffset, valueLength)
    }

    // reading more than one chunk, we will have to copy bytes into a larger
    // buffer ("value")
    const value = new Uint8Array(valueLength)

    // This is the index, within "value" at which data can be written in the
    // loop bellow. Before the loop begins, this is exactly the remaining bytes
    // to be copied from the first chunk.
    let valueIndex = firstChunk.byteLength - this.alreadyRead

    // Copy all the remaining of first chunk into "value"
    value.set(new Uint8Array(firstChunk.buffer, firstChunkOffset, valueIndex))
    this.discardFirstChunk()

    // Copy more chunks as needed. We use a "do-while" since we know we are
    // reading more than one chunk (the condition will always be true on first
    // iteration)
    do {
      const toRead = valueLength - valueIndex

      const chunk = this.chunks[0]!
      if (toRead < chunk.byteLength) {
        // we are at the last chunk. partially copy the chunk
        const view = new Uint8Array(chunk.buffer, chunk.byteOffset, toRead)
        value.set(view, valueIndex)
        this.alreadyRead = toRead
        valueIndex += toRead
        break // No need to evaluate the "while" condition (we know we're done)
      } else {
        // copy (and discard) the whole chunk
        value.set(chunk, valueIndex)
        valueIndex += chunk.byteLength
        this.discardFirstChunk()
      }
    } while (valueIndex < valueLength)

    return value
  }

  private async readUntilBuffered(bytesToRead: number) {
    if (this.isDone) return
    while (this.availableByteLength < bytesToRead) {
      const next = await this.iterator.next()
      if (next.done) {
        this.isDone = true
        break
      } else {
        this.chunks.push(next.value)
        this.chunksByteLength += next.value.byteLength
      }
    }
  }

  async close(): Promise<void> {
    if (!this.isDone && this.iterator.return) {
      await this.iterator.return()
    }
    this.isDone = true
    this.clearChunks()
  }

  private discardFirstChunk() {
    this.alreadyRead = 0
    const chunk = this.chunks.shift()
    if (chunk) this.chunksByteLength -= chunk.byteLength
  }

  private clearChunks() {
    this.alreadyRead = 0
    this.chunksByteLength = 0
    this.chunks.length = 0
  }
}
