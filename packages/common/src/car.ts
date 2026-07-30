import { setImmediate } from 'node:timers/promises'
// eslint-disable-next-line import/default, import/no-named-as-default-member
import varint from 'varint'
import * as cbor from '@atproto/lex-cbor'
import { Cid, decodeCid, ifCid, isCidForBytes } from '@atproto/lex-data'

export type CarBlock = {
  cid: Cid
  bytes: Uint8Array
}

export const encodeCarHeader = (
  roots: Cid | readonly Cid[] | null,
): Uint8Array => {
  const header = new Uint8Array(
    cbor.encode({
      version: 1,
      roots: roots == null ? [] : Array.isArray(roots) ? roots : [roots],
    }),
  )
  return concat(new Uint8Array(varint.encode(header.byteLength)), header)
}

export const encodeCarBlock = (block: CarBlock): Uint8Array =>
  concat(
    new Uint8Array(
      varint.encode(block.cid.bytes.byteLength + block.bytes.byteLength),
    ),
    block.cid.bytes,
    block.bytes,
  )

/**
 * Write a CAR v1 stream. Most callers have a single root; permissioned repos
 * declare two (a commit and an index), so roots is a list.
 */
export async function* writeCarStream(
  roots: Cid | readonly Cid[] | null,
  blocks: AsyncIterable<CarBlock> | Iterable<CarBlock>,
): AsyncIterable<Uint8Array> {
  yield encodeCarHeader(roots)
  for await (const block of blocks) {
    yield encodeCarBlock(block)
  }
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  let size = 0
  for (const part of parts) size += part.byteLength
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}

export type ReadCarOptions = {
  /**
   * When true, does not verify CID-to-content mapping within CAR.
   */
  skipCidVerification?: boolean
}

export type CarBlockIterable = AsyncGenerator<CarBlock, void, unknown> & {
  dump: () => Promise<void>
}

export const readCarStream = async (
  car: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  opts?: ReadCarOptions,
): Promise<{
  roots: Cid[]
  blocks: CarBlockIterable
}> => {
  return readCarReader(new BufferedReader(car), opts)
}

export const readCarBytes = async (
  bytes: Uint8Array,
  opts?: ReadCarOptions,
): Promise<{
  roots: Cid[]
  blocks: CarBlockIterable
}> => {
  return readCarReader(new Ui8Reader(bytes), opts)
}

export const readCarReader = async (
  reader: BytesReader,
  opts?: ReadCarOptions,
): Promise<{
  roots: Cid[]
  blocks: CarBlockIterable
}> => {
  try {
    const headerSize = await readVarint(reader)
    if (headerSize === null) {
      throw new Error('Could not parse CAR header')
    }
    const headerBytes = await reader.read(headerSize)
    const header = cbor.decode(headerBytes)
    if (header === null || typeof header !== 'object') {
      throw new Error('Could not parse CAR header')
    }
    const { version, roots } = header as {
      version?: unknown
      roots?: unknown
    }
    if (version !== 1) {
      throw new Error('Could not parse CAR header')
    }
    if (!Array.isArray(roots)) {
      throw new Error('Could not parse CAR header')
    }
    return {
      roots: roots.map((root) => {
        const cid = ifCid(root)
        if (!cid) throw new Error('Could not parse CAR header')
        return cid
      }),
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
      const cid = decodeCid(blockBytes.subarray(0, 36))
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
    if (!(await isCidForBytes(block.cid, block.bytes))) {
      throw new Error(`Not a valid CID for bytes (${block.cid.toString()})`)
    }
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
  const concatted = Buffer.concat(bytes)
  return varint.decode(concatted)
}

export interface BytesReader {
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
