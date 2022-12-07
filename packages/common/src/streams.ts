import { Stream, Readable, PassThrough } from 'stream'

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
