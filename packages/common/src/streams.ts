import {
  Duplex,
  PassThrough,
  Readable,
  Stream,
  Transform,
  TransformCallback,
  pipeline,
} from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

export const forwardStreamErrors = (...streams: Stream[]) => {
  for (let i = 1; i < streams.length; ++i) {
    const prev = streams[i - 1]
    const next = streams[i]

    prev.once('error', (err) => next.emit('error', err))
  }
}

export const cloneStream = (stream: Readable): Readable => {
  const passthrough = new PassThrough()
  forwardStreamErrors(stream, passthrough)
  return stream.pipe(passthrough)
}

export const streamSize = async (stream: Readable): Promise<number> => {
  let size = 0
  for await (const chunk of stream) {
    size += Buffer.byteLength(chunk)
  }
  return size
}

export const streamToBytes = async (stream: AsyncIterable<Uint8Array>) =>
  // @NOTE Though Buffer is a sub-class of Uint8Array, we have observed
  // inconsistencies when using a Buffer in place of Uint8Array. For this
  // reason, we convert the Buffer to a Uint8Array.
  new Uint8Array(await streamToNodeBuffer(stream))

// streamToBuffer identifier name already taken by @atproto/common-web
export const streamToNodeBuffer = async (
  stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): Promise<Buffer> => {
  const chunks: Uint8Array[] = []
  let totalLength = 0 // keep track of total length for Buffer.concat
  for await (const chunk of stream) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk)
      totalLength += Buffer.byteLength(chunk)
    } else {
      throw new TypeError('expected Uint8Array')
    }
  }
  return Buffer.concat(chunks, totalLength)
}

export const byteIterableToStream = (
  iter: AsyncIterable<Uint8Array>,
): Readable => {
  return Readable.from(iter, { objectMode: false })
}

/**
 * Coalesce a stream of Uint8Array chunks into larger chunks of at least the
 * specified size ({@link minChunkSize}). This is useful for optimizing
 * downstream processing that benefits from larger chunk sizes, such as
 * compression or hashing.
 */
export const coalesceByteStream = (
  stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  minChunkSize: number,
): Readable => {
  if (!Number.isInteger(minChunkSize) || minChunkSize < 1) {
    throw new TypeError('minChunkSize must be a positive integer')
  }

  // @NOTE On Node 22, this *does* return a PassThrough ("@types/node"
  // incorrectly types it as Writable).
  return pipeline(stream, coalesce, (_err) => {
    // Errors are expected to be handled through the stream
  }) as PassThrough

  // @NOTE This implementation is not NodeJS specific and could be exported as
  // utility (from "@atproto/common-web") if needed. We don't do it now to avoid
  // increasing the API surface of our packages.
  async function* coalesce(
    iter: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  ): AsyncGenerator<Uint8Array> {
    // @NOTE This implementation avoids as many un-necessary copies as possible
    // and only buffers incoming chunks when they are smaller than the
    // coalescing buffer.

    let buffer = new Uint8Array(minChunkSize)
    let offset = 0

    for await (const chunk of iter) {
      const freeSpace = buffer.length - offset
      if (freeSpace > chunk.length) {
        // If the incoming chunk is smaller than the free space, we copy the
        // entire chunk into the coalescing buffer and continue to the next
        // chunk
        buffer.set(chunk, offset)
        offset += chunk.length
      } else if (offset === 0 && chunk.length >= minChunkSize) {
        // If the coalescing buffer is empty and the incoming chunk is larger
        // than the coalescing buffer, we can skip any copying and yield the
        // incoming chunk directly
        yield chunk
      } else {
        // Otherwise, we need to copy as much of the incoming chunk as we can
        // into the coalescing buffer and yield the full coalescing buffer.
        buffer.set(chunk.subarray(0, freeSpace), offset)
        yield buffer

        // We create a new coalescing buffer (for future use)
        buffer = new Uint8Array(minChunkSize)
        offset = 0

        const remainingBytes = chunk.subarray(freeSpace)
        if (remainingBytes.length > minChunkSize) {
          // If the remaining of chunk is still too big to fit in the
          // coalescing buffer, we yield it directly without copying it
          yield remainingBytes
        } else if (remainingBytes.length > 0) {
          // Otherwise, we copy the remaining bytes into the coalescing buffer
          // and continue to the next chunk
          buffer.set(remainingBytes, offset)
          offset += remainingBytes.length
        }
      }
    }

    // Yield any remaining bytes in the coalescing buffer
    if (offset > 0) {
      yield buffer.subarray(0, offset)
    }
  }
}

export const bytesToStream = (bytes: Uint8Array): Readable => {
  const stream = new Readable()
  stream.push(bytes)
  stream.push(null)
  return stream
}

export class MaxSizeChecker extends Transform {
  totalSize = 0
  constructor(
    public maxSize: number,
    public createError: () => Error,
  ) {
    super()
  }
  _transform(chunk: Uint8Array, _enc: BufferEncoding, cb: TransformCallback) {
    this.totalSize += chunk.length
    if (this.totalSize > this.maxSize) {
      cb(this.createError())
    } else {
      cb(null, chunk)
    }
  }
}

export function decodeStream(
  stream: Readable,
  contentEncoding?: string | string[],
): Readable
export function decodeStream(
  stream: AsyncIterable<Uint8Array>,
  contentEncoding?: string | string[],
): AsyncIterable<Uint8Array> | Readable
export function decodeStream(
  stream: Readable | AsyncIterable<Uint8Array>,
  contentEncoding?: string | string[],
): Readable | AsyncIterable<Uint8Array> {
  const decoders = createDecoders(contentEncoding)
  if (decoders.length === 0) return stream
  return pipeline([stream as Readable, ...decoders], () => {}) as Duplex
}

/**
 * Create a series of decoding streams based on the content-encoding header. The
 * resulting streams should be piped together to decode the content.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9110#section-8.4.1}
 */
export function createDecoders(contentEncoding?: string | string[]): Duplex[] {
  const decoders: Duplex[] = []

  if (contentEncoding?.length) {
    const encodings: string[] = Array.isArray(contentEncoding)
      ? contentEncoding.flatMap(commaSplit)
      : contentEncoding.split(',')
    for (const encoding of encodings) {
      const normalizedEncoding = normalizeEncoding(encoding)

      // @NOTE
      // > The default (identity) encoding [...] is used only in the
      // > Accept-Encoding header, and SHOULD NOT be used in the
      // > Content-Encoding header.
      if (normalizedEncoding === 'identity') continue

      decoders.push(createDecoder(normalizedEncoding))
    }
  }

  return decoders.reverse()
}

function commaSplit(header: string): string[] {
  return header.split(',')
}

function normalizeEncoding(encoding: string) {
  // https://www.rfc-editor.org/rfc/rfc7231#section-3.1.2.1
  // > All content-coding values are case-insensitive...
  return encoding.trim().toLowerCase()
}

function createDecoder(normalizedEncoding: string): Duplex {
  switch (normalizedEncoding) {
    // https://www.rfc-editor.org/rfc/rfc9112.html#section-7.2
    case 'gzip':
    case 'x-gzip':
      return createGunzip()
    case 'deflate':
      return createInflate()
    case 'br':
      return createBrotliDecompress()
    case 'identity':
      return new PassThrough()
    default:
      throw new TypeError(
        `Unsupported content-encoding: "${normalizedEncoding}"`,
      )
  }
}
