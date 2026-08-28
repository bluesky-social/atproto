import { decode as cborDecode } from '@atproto/lex-cbor'
import { type Cid, asCid, decodeCid, isCidForBytes } from '@atproto/lex-data'
import type { CarBlock } from './car-block.js'
import { type BytesReader, createBytesReader } from './lib/bytes-reader.js'

export type ReadCarOptions = {
  /**
   * When true, does not verify CID-to-content mapping within CAR while reading.
   *
   * @default false
   */
  skipCidVerification?: boolean
}

export interface CarReader extends AsyncDisposable {
  roots: Cid[]
  blocks: AsyncIterableIterator<CarBlock>
  destroy(): Promise<void>
}

/**
 * @note the returned reader must be disposed of when done, either by calling
 * `destroy()` or using `await using` syntax.
 *
 * @example
 *
 * ```ts
 * import { readCarStream } from '@atproto/car'
 *
 * await using carReader = await readCarStream(stream)
 *
 * carReader.roots // array of CIDs
 *
 * for await (const block of carReader.blocks) {
 *   // do something with block.cid and block.bytes
 * }
 * ```
 *
 * @example
 *
 * ```ts
 * import { readCarStream } from '@atproto/car'
 *
 * await using carReader = await readCarStream(stream)
 *
 * carReader.roots // array of CIDs
 *
 * // The bytes are never consumed (not even read from the input), but the reader
 * // (and input stream) is automatically cleaned up when the block is exited.
 * ```
 */
export async function readCarStream(
  input: Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  opts?: ReadCarOptions,
): Promise<CarReader> {
  const reader = createBytesReader(input)
  try {
    const headerBytes = await reader.readFrame()
    if (headerBytes === null) {
      throw new Error('Could not parse CAR header')
    }
    const header = cborDecode(headerBytes)
    if (header === null || typeof header !== 'object') {
      throw new Error('Could not parse CAR header')
    }
    const { version, roots } = header as Record<string, unknown>
    if (version !== 1) {
      throw new Error('Could not parse CAR header')
    }
    if (!Array.isArray(roots)) {
      throw new Error('Could not parse CAR header')
    }

    const generator = eventLoopYieldingGenerator(readCarBlocks(reader))
    const blocks = opts?.skipCidVerification
      ? generator
      : verifyIncomingCarBlocks(generator)

    const destroy = async () => {
      try {
        // Allow the generator function to finish its finally block, which will
        // close the reader and underlying stream.
        await blocks.return()
      } finally {
        // If the generator was never started, its finally block will not have
        // run, so we need to close the reader here.
        if (!reader.isDone) await reader.destroy()
      }
    }

    return {
      roots: roots.map(asCid),
      blocks,
      destroy,
      [Symbol.asyncDispose]: destroy,
    }
  } catch (err) {
    await reader.destroy()
    throw err
  }
}

async function* readCarBlocks(
  reader: BytesReader,
): AsyncGenerator<CarBlock, void, unknown> {
  try {
    while (!reader.isDone) {
      const block = await reader.readFrame()
      if (!block) break

      if (block.byteLength < 36) {
        throw new Error(`Invalid block size: ${block.byteLength}`)
      }
      const cid = decodeCid(block.subarray(0, 36), { flavor: 'cbor' })
      const bytes = block.subarray(36)
      yield { cid, bytes }
    }
  } finally {
    await reader.destroy()
  }
}

async function* verifyIncomingCarBlocks(
  car: Iterable<CarBlock> | AsyncIterable<CarBlock>,
): AsyncGenerator<CarBlock, void, unknown> {
  for await (const block of car) {
    if (!(await isCidForBytes(block.cid, block.bytes))) {
      throw new Error(`Not a valid CID for bytes (${block.cid.toString()})`)
    }
    yield block
  }
}

/**
 * Yield to the event loop every {@link frequency} blocks in the case the
 * incoming CAR is synchronous, this can end up jamming up the thread
 */
async function* eventLoopYieldingGenerator<T>(
  iterable: Iterable<T> | AsyncIterable<T>,
  frequency = 25,
): AsyncGenerator<T, void, unknown> {
  if (frequency <= 0) return yield* iterable

  let count = 0
  for await (const item of iterable) {
    yield item
    count++
    if (count % frequency === 0) {
      await new Promise((resolve) => setImmediate(resolve))
    }
  }
}
