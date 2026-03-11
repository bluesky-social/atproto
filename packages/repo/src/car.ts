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

  /** Number of bytes that were already consumed from the first {@link chunks} */
  private alreadyRead = 0

  /** Total bytes in {@link chunks} */
  private chunksByteLength = 0

  constructor(stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>) {
    this.iterator =
      Symbol.asyncIterator in stream
        ? stream[Symbol.asyncIterator]()
        : stream[Symbol.iterator]()
  }

  /** Number of bytes currently buffered and available for reading */
  get bufferedByteLength() {
    return this.chunksByteLength - this.alreadyRead
  }

  async read(bytesToRead: number): Promise<Uint8Array> {
    await this.readUntilBuffered(bytesToRead)

    const resultLength = Math.min(bytesToRead, this.bufferedByteLength)
    if (resultLength <= 0) return new Uint8Array()

    const firstChunk = this.chunks[0]!
    const firstChunkStart = this.alreadyRead
    const firstChunkRemaining = firstChunk.byteLength - firstChunkStart

    if (firstChunkRemaining < 0) {
      // Should never happen
      throw new Error('Unexpected BufferedReader state')
    }

    // If the data to be read is less or equal to the remaining bytes in the
    // first chunk, return a sub array of that chunk.
    if (resultLength < firstChunkRemaining) {
      // partial read of first chunk
      const firstChunkEnd = firstChunkStart + resultLength
      this.alreadyRead = firstChunkEnd
      return firstChunk.subarray(firstChunkStart, firstChunkEnd)
    } else if (resultLength === firstChunkRemaining) {
      // read exactly the remaining bytes of first chunk (and discard it)
      this.discardFirstChunk() // updates this.alreadyRead
      return firstChunk.subarray(firstChunkStart)
    }

    // reading more than one chunk, we will have to copy bytes into a larger
    // buffer
    const result = new Uint8Array(resultLength)

    // Copy all the remaining of first chunk into "result"
    copy(result, 0, firstChunk, firstChunkStart, firstChunkRemaining)
    this.discardFirstChunk()

    // This is the index, within "result" at which data can be written in the
    // loop below. Before the loop begins, this is exactly the remaining bytes
    // to be copied from the first chunk.
    let resultIndex = firstChunkRemaining

    // Copy more chunks as needed. We use a "do-while" since we know we are
    // reading more than one chunk (the condition will always be true on first
    // iteration)
    do {
      const missingLength = resultLength - resultIndex

      const currentChunk = this.chunks[0]!
      if (missingLength >= currentChunk.byteLength) {
        // copy (and discard) the whole chunk
        copy(result, resultIndex, currentChunk)
        this.discardFirstChunk()
        resultIndex += currentChunk.byteLength
      } else {
        // the current chunk has more bytes than we need (missingLength), so we
        // copy only what we need and update "alreadyRead" accordingly
        copy(result, resultIndex, currentChunk, 0, missingLength)
        this.alreadyRead = missingLength
        resultIndex += missingLength
        break // we're done (no need to eval the loop condition)
      }
    } while (resultIndex < resultLength)

    return result
  }

  private async readUntilBuffered(bytesToRead: number) {
    if (this.isDone) return
    while (this.bufferedByteLength < bytesToRead) {
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
    this.chunks.length = 0
    this.chunksByteLength = 0
  }
}

function copy(
  dest: Uint8Array,
  destOffset: number,
  src: Uint8Array,
  srcOffset: number = 0,
  length: number = src.byteLength - srcOffset,
) {
  const srcView =
    srcOffset === 0 && length === src.byteLength
      ? src // No need to create a view of the source if we're using all of it
      : src.subarray(srcOffset, srcOffset + length)
  dest.set(srcView, destOffset)
}
