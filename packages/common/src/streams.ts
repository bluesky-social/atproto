import {
  Duplex,
  PassThrough,
  pipeline,
  Readable,
  Stream,
  Transform,
  TransformCallback,
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
