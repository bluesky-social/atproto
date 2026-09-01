import { decode as cborDecode } from '@atproto/lex-cbor'
import { type Cid, asCid, decodeCid, isCidForBytes } from '@atproto/lex-data'
import type { CarBlock } from './car-block.js'
import { type BytesReader, createBytesReader } from './lib/bytes-reader.js'
import { eventLoopYieldingGenerator } from './lib/util.js'

export type ReadCarOptions = {
  /**
   * When true, does not verify CID-to-content mapping within CAR while reading.
   *
   * @default false
   */
  skipCidVerification?: boolean
}

export class CarReader
  implements AsyncIterable<CarBlock, void, unknown>, AsyncDisposable
{
  private constructor(
    readonly roots: readonly Cid[],
    readonly blocks: AsyncGenerator<CarBlock, void, unknown>,
    private readonly reader: BytesReader,
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<CarBlock, void, unknown> {
    yield* this.blocks
  }

  async [Symbol.asyncDispose](): Promise<void> {
    try {
      // Allow the generator function to finish its finally block, which will
      // close the reader and underlying stream.
      await this.blocks.return()
    } finally {
      // If the generator was never started, its finally block will not have
      // run, so we need to close the reader here.
      if (!this.reader.isDone) await this.reader.destroy()
    }
  }

  /**
   * @deprecated Prefer using `await using carReader = await readCarStream(...)`
   * instead, which will automatically clean up the reader when done.
   */
  async destroy(): Promise<void> {
    return this[Symbol.asyncDispose]()
  }

  static async from(
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

      return new CarReader(roots.map(asCid), blocks, reader)
    } catch (err) {
      await reader.destroy()
      throw err
    }
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
