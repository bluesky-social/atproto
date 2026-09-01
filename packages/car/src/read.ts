import type { Cid } from '@atproto/lex-data'
import { BlockMap } from './block-map.js'
import { CarReader, type ReadCarOptions } from './car-reader.js'

/**
 * @note the returned reader must be disposed of when done, either by calling
 * `destroy()` or using `await using` syntax.
 *
 * @example
 *
 * ```ts
 * import { CarReader } from '@atproto/car'
 *
 * await using carReader = await CarReader.from(stream)
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
 * import { CarReader } from '@atproto/car'
 *
 * await using carReader = await CarReader.from(stream)
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
  return CarReader.from(input, opts)
}

export async function readCar(
  bytes: Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  opts?: ReadCarOptions,
): Promise<{ roots: readonly Cid[]; blocks: BlockMap }> {
  await using reader = await CarReader.from(bytes, opts)
  const blocks = await BlockMap.from(reader)
  return { roots: reader.roots, blocks }
}

export async function readCarWithRoot(
  bytes: Uint8Array,
  opts?: ReadCarOptions,
): Promise<{ root: Cid; blocks: BlockMap }> {
  const { roots, blocks } = await readCar(bytes, opts)
  const { length, 0: root } = roots
  if (length !== 1) {
    throw new Error(`Expected one root, got ${length}`)
  }
  return { root, blocks }
}
