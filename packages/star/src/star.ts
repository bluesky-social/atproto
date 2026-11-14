import { type LexValue, decode, encode } from '@atproto/lex-cbor'
import { type LexMap, isPlainObject, ui8Equals } from '@atproto/lex-data'
import { BytesReader } from './bytes-reader.js'
import { StarParseError } from './error.js'

/**
 * Reading and writing STAR archives: a metadata header, then key/value pairs
 * each preceded by a `0x01` control byte, then a `0x00` control byte to end the
 * archive.
 *
 * ```
 * [ magic | len | meta ] [ 1 | len | key | len | val ] [ 1 | len | key | len | val ] ... [ 0 ]
 * ```
 *
 * Each `len` is an unsigned varint in its shortest form. Applications define
 * what the keys and values mean in a profile, named by the metadata's `$type`.
 *
 * @see https://dasl.ing/star.html
 */

const STAR_MAGIC = new Uint8Array([0x2a, 0x6c, 0x01, 0x00])

const CONTROL_PAIR = 0x01
const CONTROL_END = 0x00

const MAX_VARINT_BYTES = 9

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
    yield Uint8Array.of(CONTROL_PAIR)
    yield* frame(key)
    yield* frame(value)
  }
  yield Uint8Array.of(CONTROL_END)
}

function* frame(bytes: Uint8Array): Generator<Uint8Array> {
  yield encodeVarint(bytes.length)
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
 * STAR sets no size limits of its own, so each length is unlimited unless set
 * here, as a profile or an application handling untrusted input may want.
 */
export type ReadStarOptions = {
  maxMetaLength?: number
  maxKeyLength?: number
  maxValueLength?: number
}

/**
 * Read a STAR archive. The header is read eagerly, the pairs lazily as `pairs` is
 * drained.
 *
 * Lengths are checked against the limits in `opts` before a frame is read, so an
 * oversized frame is never buffered.
 */
export async function readStar(
  input: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  opts: ReadStarOptions = {},
): Promise<StarReader> {
  const {
    maxMetaLength = Infinity,
    maxKeyLength = Infinity,
    maxValueLength = Infinity,
  } = opts
  const reader = new BytesReader(input)
  try {
    const magic = await reader.read(STAR_MAGIC.length)
    if (!ui8Equals(magic, STAR_MAGIC)) {
      throw new StarParseError('invalid magic bytes')
    }
    const metaBytes = await readFrame(reader, maxMetaLength)
    return {
      meta: parseMeta(metaBytes),
      pairs: readPairs(reader, maxKeyLength, maxValueLength),
      [Symbol.asyncDispose]: () => reader.destroy(),
    }
  } catch (err) {
    await reader.destroy()
    throw err
  }
}

async function* readPairs(
  reader: BytesReader,
  maxKeyLength: number,
  maxValueLength: number,
): AsyncGenerator<StarPair> {
  try {
    while (true) {
      const control = await readByte(reader)
      if (control === CONTROL_END) break
      if (control !== CONTROL_PAIR) {
        throw new StarParseError(`invalid control byte: ${control}`)
      }
      const key = await readFrame(reader, maxKeyLength)
      const value = await readFrame(reader, maxValueLength)
      yield { key, value }
    }
    const trailing = await reader.read(1)
    if (trailing.length > 0) {
      throw new StarParseError('unexpected bytes after end of archive')
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

async function readFrame(
  reader: BytesReader,
  maxLength: number,
): Promise<Uint8Array> {
  const length = await readVarint(reader)
  if (length > maxLength) {
    throw new StarParseError(`length ${length} exceeds limit of ${maxLength}`)
  }
  const bytes = await reader.read(length)
  if (bytes.length !== length) {
    throw new StarParseError('unexpected end of archive')
  }
  return bytes
}

// Unsigned varint: 7 bits per byte, least significant group first, with the
// high bit set on every byte but the last. Arithmetic rather than bitwise
// operators, since lengths can exceed 32 bits.
function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = []
  while (value >= 0x80) {
    bytes.push((value % 0x80) | 0x80)
    value = Math.floor(value / 0x80)
  }
  bytes.push(value)
  return Uint8Array.from(bytes)
}

async function readVarint(reader: BytesReader): Promise<number> {
  let value = 0
  for (let i = 0; i < MAX_VARINT_BYTES; i++) {
    const byte = await readByte(reader)
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

async function readByte(reader: BytesReader): Promise<number> {
  const [byte] = await reader.read(1)
  if (byte === undefined) {
    throw new StarParseError('unexpected end of archive')
  }
  return byte
}
