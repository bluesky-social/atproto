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

/**
 * This code was optimized for performance. See
 * {@link https://github.com/bluesky-social/atproto/pull/4729 #4729} for more details
 * and benchmarks.
 */
class BufferedReader implements BytesReader {
  iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array>
  isDone = false

  /** fifo list of chunks to consume */
  private chunks: Uint8Array[] = []

  constructor(stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>) {
    this.iterator =
      Symbol.asyncIterator in stream
        ? stream[Symbol.asyncIterator]()
        : stream[Symbol.iterator]()
  }

  /** Number of bytes currently buffered and available for reading */
  get bufferedByteLength() {
    let total = 0
    for (let i = 0; i < this.chunks.length; i++) {
      total += this.chunks[i].byteLength
    }
    return total
  }

  /**
   * @note concurrent reads are **NOT** supported by the current implementation
   * and would require call to readUntilBuffered to be using a fifo lock for
   * read()s to be processed in fifo order.
   */
  async read(bytesToRead: number): Promise<Uint8Array> {
    const bytesNeeded = bytesToRead - this.bufferedByteLength
    if (bytesNeeded > 0 && !this.isDone) {
      await this.readUntilBuffered(bytesNeeded)
    }

    const resultLength = Math.min(bytesToRead, this.bufferedByteLength)
    if (resultLength <= 0) return new Uint8Array()

    const firstChunk = this.consumeChunk(resultLength)
    if (firstChunk.byteLength === resultLength) {
      // If the data consumed from the first chunk contains all we need, return
      // it as-is. This allows to avoid any copy operation.
      return firstChunk
    }

    // The first chunk does not have all the data we need. We have to copy
    // multiple chunks into a larger buffer
    const result = new Uint8Array(resultLength)
    let resultWriteIndex = 0

    // Copy the first chunk into the result buffer
    result.set(firstChunk, resultWriteIndex)
    resultWriteIndex += firstChunk.byteLength

    // Copy more chunks as needed (we use do-while because we *know* we need
    // more than one chunk)
    do {
      const missingLength = resultLength - resultWriteIndex
      const currentChunk = this.consumeChunk(missingLength)

      result.set(currentChunk, resultWriteIndex)
      resultWriteIndex += currentChunk.byteLength
    } while (resultWriteIndex < resultLength)

    return result
  }

  private async readUntilBuffered(bytesNeeded: number) {
    let bytesRead = 0
    while (bytesRead < bytesNeeded) {
      const next = await this.iterator.next()
      if (next.done) {
        this.isDone = true
        break
      } else {
        this.chunks.push(next.value)
        bytesRead += next.value.byteLength
      }
    }
    return bytesRead
  }

  private consumeChunk(bytesToConsume: number) {
    const firstChunk = this.chunks[0]!
    if (bytesToConsume < firstChunk.byteLength) {
      // return a sub-view of the data being read and replace the first chunk
      // with a sub-view that does not contain that data.

      // @NOTE for some reason, subarray() revealed to be 7-8% slower in NodeJS
      // benchmarks.

      // this.chunks[0] = firstChunk.subarray(bytesToConsume)
      // return firstChunk.subarray(0, bytesToConsume)

      this.chunks[0] = new Uint8Array(
        firstChunk.buffer,
        firstChunk.byteOffset + bytesToConsume,
        firstChunk.byteLength - bytesToConsume,
      )
      return new Uint8Array(
        firstChunk.buffer,
        firstChunk.byteOffset,
        bytesToConsume,
      )
    } else {
      // First chunk is being read in full, discard it
      this.chunks.shift()
      return firstChunk
    }
  }

  async close(): Promise<void> {
    try {
      if (!this.isDone && this.iterator.return) {
        await this.iterator.return()
      }
    } finally {
      this.isDone = true
      this.chunks.length = 0
    }
  }
}
