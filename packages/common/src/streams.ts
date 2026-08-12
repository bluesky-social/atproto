import { type Hash, type HashOptions, createHash } from 'node:crypto'
import {
  type Duplex,
  PassThrough,
  Readable,
  type Stream,
  Transform,
  type TransformCallback,
  Writable,
  pipeline,
} from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

/**
 * @deprecated use native stream piping instead.
 */
export const forwardStreamErrors = (...streams: Stream[]) => {
  for (let i = 1; i < streams.length; ++i) {
    const prev = streams[i - 1]
    const next = streams[i]

    prev.once('error', (err) => next.emit('error', err))
  }
}

/**
 * @deprecated This function has several flaws:
 * - It only works if all the stream are setup during the same tick
 * - It does not apply any backpressure to the source stream, which can lead to
 *   memory issues
 * Use {@link Tee} instead, which is a more robust implementation of the same
 * concept.
 */
export const cloneStream = (stream: Readable): Readable => {
  const passthrough = new PassThrough()
  forwardStreamErrors(stream, passthrough)
  return stream.pipe(passthrough)
}

/**
 * A {@link Transform} that forwards every chunk downstream while mirroring a
 * copy into a "branch" {@link Writable} (exposed through {@link Tee.branch}, e.g.
 * to be cached). The tee is paced by the slower of its two consumers, bounding
 * how much data gets buffered. The branch is completed when the source ends,
 * and torn down if the tee errors or is destroyed early (e.g. the client
 * disconnected).
 *
 * Consuming the branch is best-effort: its failures are swallowed here and must
 * never break the main stream.
 *
 * Because the tee is a {@link Transform}, its *main* output is a downstream
 * pipeline stage — so `pipeline([readable, tee, main])` tears the tee (and the
 * source) down as soon as `main` fails. If you need the branch to keep going
 * after the main consumer disappears (or vice-versa), use {@link fanOut}, which
 * owns both outputs instead of exposing one as a pipeline stage.
 */
export class Tee extends Transform {
  readonly branch: Writable
  #branchFailed = false

  constructor(branch: Writable | ((readable: Readable) => void)) {
    super()
    if (typeof branch === 'function') {
      const passthrough = new PassThrough({ autoDestroy: true })
      branch(passthrough)
      this.branch = passthrough
    } else {
      this.branch = branch
    }

    // The branch is best-effort: its failures must never break or stall the
    // main stream.
    this.branch.on('error', () => {
      this.#branchFailed = true
    })
  }

  get branchWritable() {
    return !this.#branchFailed && this.branch.writable
  }

  _transform(chunk: unknown, _enc: BufferEncoding, cb: TransformCallback) {
    // Forward downstream, applying backpressure if either branch is slower.
    if (!this.branchWritable || this.branch.write(chunk)) {
      cb(null, chunk)
    } else {
      const done = () => {
        this.branch.off('drain', done)
        this.branch.off('close', done)
        this.branch.off('error', done)
        cb(null, chunk)
      }
      // Resume on 'drain' (branch caught up) but also on 'close'/'error' so the
      // tee is never stuck if the branch dies mid-write — e.g. a branch created
      // with `autoDestroy: false`, which errors without emitting 'close'.
      this.branch.once('drain', done)
      this.branch.once('close', done)
      this.branch.once('error', done)
    }
  }

  _flush(cb: TransformCallback) {
    if (this.branchWritable) this.branch.end()
    cb()
  }

  _destroy(err: Error | null, cb: (err?: Error | null) => void) {
    // A failed branch has already torn itself down (or given up); leave it be
    // rather than emitting a second, spurious error on it.
    if (this.branchWritable) {
      this.branch.destroy(err ?? new Error('Tee destroyed'))
    }

    cb(err)
  }
}

/**
 * A {@link Writable} that mirrors everything written to it into several
 * independent "sinks", pacing the input by the slowest sink that is still
 * alive. Unlike {@link Tee}, the sinks are *owned* by the fan-out rather than
 * being downstream pipeline stages, which lets the two error domains be kept
 * apart:
 *
 * - An *output* (sink) that errors or ends early is simply dropped; the other
 *   sinks — and the input — keep going. Its error is swallowed (best-effort),
 *   exactly like a {@link Tee} branch.
 * - The *input* (writable side) is only torn down once *every* sink has died,
 *   or if the input itself fails — in which case the failure is propagated to
 *   every surviving sink.
 *
 * Designed to be the destination of a pipeline:
 *
 * ```
 * pipeline([readable, ...transforms, fanOut(main, branch)])
 * ```
 *
 * If `main` disconnects (e.g. an HTTP response whose client went away), `branch`
 * still receives the full stream (e.g. to finish populating a cache), and
 * vice-versa. A sink may also be provided as a function receiving a
 * {@link Readable} to consume, mirroring {@link Tee}'s constructor.
 */
export function fanOut(
  ...outputs: ReadonlyArray<Writable | ((readable: Readable) => void)>
): Writable {
  const sinks = outputs.map((output) => {
    if (typeof output !== 'function') return output
    const passthrough = new PassThrough()
    output(passthrough)
    return passthrough
  })

  // Sinks still able to receive data. A sink that errors or closes is dropped
  // and never written to again; its 'error' is swallowed here so a dead sink can
  // neither crash the process nor disturb the surviving sinks (other listeners,
  // e.g. a reader consuming it, still observe the error).
  const alive = new Set<Writable>(sinks)
  const drop = (sink: Writable) => alive.delete(sink)
  for (const sink of sinks) {
    sink.on('error', () => drop(sink))
    sink.on('close', () => drop(sink))
  }

  // Whether the input ended cleanly, so we can distinguish a normal completion
  // (let the sinks finish the data we handed them) from a teardown (destroy
  // them).
  let ended = false

  return new Writable({
    write(chunk, _enc, cb) {
      // Write to every live sink, then invoke `cb` once they have all either
      // accepted the chunk, drained, or died — pacing the input by the slowest
      // surviving sink.
      let waiting = 1 // guard so `cb` can't fire before the loop completes
      const settle = () => {
        if (--waiting > 0) return
        // If every sink died while handling this chunk, tear the input down.
        cb(alive.size === 0 ? new Error('fanOut: all sinks ended') : null)
      }

      for (const sink of alive) {
        if (!sink.writable) {
          drop(sink)
          continue
        }
        if (sink.write(chunk)) continue

        waiting++
        const done = () => {
          sink.off('drain', done)
          sink.off('close', done)
          sink.off('error', done)
          settle()
        }
        // Resume on 'drain', but also on 'close'/'error' so a sink that dies
        // mid-write (e.g. one created with autoDestroy:false, which errors
        // without emitting 'close') never leaves the fan-out stuck.
        sink.once('drain', done)
        sink.once('close', done)
        sink.once('error', done)
      }

      settle()
    },
    final(cb) {
      ended = true
      for (const sink of alive) {
        if (sink.writable) sink.end()
      }
      cb()
    },
    destroy(err, cb) {
      // A clean end (`_final` already ran) leaves the sinks to flush what they
      // were handed; any other teardown propagates to the sinks we own.
      if (!ended || err) {
        for (const sink of alive) {
          if (sink.writable) sink.destroy(err ?? undefined)
        }
      }
      cb(err)
    },
  })
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
    public createError: () => Error = () =>
      new Error(`Max size of ${maxSize} bytes exceeded`),
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

export class HashPassThrough extends Transform {
  private readonly hash: Hash
  #digest?: Buffer<ArrayBuffer>

  constructor(algorithm: string, options?: HashOptions) {
    super()
    this.hash = createHash(algorithm, options)
  }

  _transform(chunk: Uint8Array, _enc: BufferEncoding, cb: TransformCallback) {
    this.hash.update(chunk)
    cb(null, chunk)
  }

  _flush(cb: TransformCallback) {
    const digest = this.hash.digest()
    this.#digest = digest
    this.emit('hash', digest)
    cb()
  }

  get digest(): Buffer<ArrayBuffer> {
    if (this.#digest) return this.#digest
    throw new Error('Hash not yet computed. Wait for the stream to finish.')
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
