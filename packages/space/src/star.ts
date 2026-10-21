import { type BytesReader, createBytesReader, encodeVarInt } from '@atproto/car'
import { type LexValue, decode, encode } from '@atproto/lex-cbor'
import { type LexMap, isPlainObject, ui8Equals } from '@atproto/lex-data'
import { StarParseError } from './error.js'

/**
 * Reading and writing STAR-lite v1 archives: a metadata header followed by
 * key/value pairs until EOF.
 *
 * ```
 * [ magic | len | meta ] [ len | key | len | val ] [ len | key | len | val ] ...
 * ```
 *
 * Each `len` is an unsigned varint in its shortest form. Applications define
 * what the keys and values mean in a profile, named by the metadata's `$type`.
 *
 * @see https://tangled.org/microcosm.blue/star/tree/main/v1-star
 */

export const STAR_MAGIC = new Uint8Array([0x2a, 0x6c, 0x01, 0x00])

const MAX_VARINT_BYTES = 6

export type StarMeta = LexMap & { $type: string }

export type StarPair = {
  key: Uint8Array
  value: Uint8Array
}

export async function* writeStar(
  meta: StarMeta,
  pairs: AsyncIterable<StarPair> | Iterable<StarPair>,
): AsyncGenerator<Uint8Array> {
  yield STAR_MAGIC
  yield* frame(encode(meta))
  for await (const { key, value } of pairs) {
    yield* frame(key)
    yield* frame(value)
  }
}

function* frame(bytes: Uint8Array): Generator<Uint8Array> {
  yield encodeVarInt(bytes.length)
  yield bytes
}

/**
 * @note **IMPORTANT** to avoid resource leaks, the {@link StarReader} must be
 * disposed of when done, either by calling its `[Symbol.asyncDispose]()`
 * method, by using it in a `using` statement, or by consuming at least one of
 * its `pairs` (and then `return()`ing the iterator).
 */
export type StarReader = AsyncDisposable & {
  meta: StarMeta
  pairs: AsyncGenerator<StarPair>
}

/**
 * Read a STAR archive. The header is read eagerly, the pairs lazily as `pairs` is
 * drained.
 */
export const readStar = async (
  input: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<StarReader> => {
  const reader = createBytesReader(input)
  try {
    const magic = await reader.read(STAR_MAGIC.length)
    if (!ui8Equals(magic, STAR_MAGIC)) {
      throw new StarParseError('invalid magic bytes')
    }
    const metaBytes = await readFrame(reader)
    if (metaBytes === null) {
      throw new StarParseError('missing metadata')
    }
    return {
      meta: parseMeta(metaBytes),
      pairs: readPairs(reader),
      [Symbol.asyncDispose]: () => reader.destroy(),
    }
  } catch (err) {
    await reader.destroy()
    throw err
  }
}

async function* readPairs(reader: BytesReader): AsyncGenerator<StarPair> {
  try {
    while (true) {
      // EOF is only allowed at a pair boundary.
      const key = await readFrame(reader)
      if (key === null) return
      const value = await readFrame(reader)
      if (value === null) {
        throw new StarParseError('missing value for key')
      }
      yield { key, value }
    }
  } finally {
    await reader.destroy()
  }
}

function parseMeta(bytes: Uint8Array): StarMeta {
  let meta: LexValue
  try {
    meta = decode(bytes)
  } catch (cause) {
    throw new StarParseError('invalid metadata', { cause })
  }
  if (!isPlainObject(meta) || typeof meta.$type !== 'string') {
    throw new StarParseError('metadata must be a map with a $type')
  }
  // The decoder accepts some non-canonical forms (such as unsorted map keys),
  // so check that the metadata re-encodes to the same bytes.
  if (!ui8Equals(encode(meta), bytes)) {
    throw new StarParseError('metadata is not canonical DRISL')
  }
  return meta as StarMeta
}

// Null at EOF before a frame starts, which is only allowed at a pair boundary.
async function readFrame(reader: BytesReader): Promise<Uint8Array | null> {
  const length = await readVarint(reader)
  if (length === null) return null
  const bytes = await reader.read(length)
  if (bytes.length !== length) {
    throw new StarParseError('unexpected end of archive')
  }
  return bytes
}

// Unsigned varint: 7 bits per byte, least significant group first, with the
// high bit set on every byte but the last. Arithmetic rather than bitwise
// operators, since lengths can exceed 32 bits.
async function readVarint(reader: BytesReader): Promise<number | null> {
  let value = 0
  for (let i = 0; i < MAX_VARINT_BYTES; i++) {
    const [byte] = await reader.read(1)
    if (byte === undefined) {
      if (i === 0) return null
      throw new StarParseError('unexpected end of archive')
    }
    value += (byte & 0x7f) * 2 ** (7 * i)
    if (byte < 0x80) {
      // A final zero byte only pads the encoding, which STAR forbids.
      if (byte === 0 && i > 0) {
        throw new StarParseError('non-canonical varint')
      }
      return value
    }
  }
  throw new StarParseError('varint too long')
}
