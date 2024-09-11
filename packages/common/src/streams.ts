import {
  Stream,
  Readable,
  PassThrough,
  Transform,
  TransformCallback,
} from 'stream'

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
    size += chunk.length
  }
  return size
}

export const streamToBytes = async (
  stream: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): Promise<Buffer> => {
  const chunks: Uint8Array[] = []
  let totalLength = 0 // keep track of total length for Buffer.concat
  for await (const chunk of stream) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk)
    } else {
      throw new TypeError('expected Uint8Array')
    }
    totalLength += Buffer.byteLength(chunk)
  }
  // Note Buffer is a subclass of Uint8Array
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
