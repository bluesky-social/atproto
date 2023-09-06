import {
  Stream,
  Readable,
  PassThrough,
  Transform,
  TransformCallback,
} from 'stream'

export const forwardStreamErrors = (...streams: Stream[]) => {
  for (let i = 0; i < streams.length; ++i) {
    const stream = streams[i]
    const next = streams[i + 1]
    if (next) {
      stream.once('error', (err) => next.emit('error', err))
    }
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

export const streamToBytes = async (stream: Readable): Promise<Uint8Array> => {
  const bufs: Buffer[] = []
  for await (const bytes of stream) {
    bufs.push(bytes)
  }
  return new Uint8Array(Buffer.concat(bufs))
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
  constructor(public maxSize: number, public createError: () => Error) {
    super()
  }
  _transform(chunk: Uint8Array, _enc: BufferEncoding, cb: TransformCallback) {
    this.totalSize += chunk.length
    if (this.totalSize > this.maxSize) {
      return this.destroy(this.createError())
    }
    return cb(null, chunk)
  }
}
