import { dataplaneLogger as logger } from '../../../logger'
import { Redis } from '../../../redis'

export function streamLengthBackpressure(opts: {
  redis: Redis
  stream: string
  highWaterMark?: number
}) {
  const { redis, stream, highWaterMark = 100000 } = opts
  let lastLengthCheck = 0
  return async function checkLength(signal: AbortSignal) {
    if (signal.aborted) {
      return
    }
    const now = Date.now()
    if (now - lastLengthCheck <= 5000) {
      return
    }
    try {
      const [len] = await redis.streamLengths([stream])
      if (len >= highWaterMark) {
        throw new HighWaterMarkError({ stream, len, highWaterMark })
      }
      lastLengthCheck = now
    } catch (err) {
      if (err instanceof HighWaterMarkError) {
        logger.warn(err.data, 'stream length hit high water mark')
      } else {
        logger.error({ err }, 'stream length check failed')
      }
      await wait(5000, signal)
      await checkLength(signal)
    }
  }
}

class HighWaterMarkError extends Error {
  name = 'HighWaterMarkError'
  constructor(
    public data: { stream: string; len: number; highWaterMark: number },
    options?: ErrorOptions,
  ) {
    const { stream, len, highWaterMark } = data
    super(
      `stream length hit high water mark: ${stream} ${len} (${highWaterMark})`,
      options,
    )
  }
}

export function cursorFor({ stream, host }: { stream: string; host: string }) {
  return `${stream}:cursor:${host.replace(/^https?:\/\//, '')}`
}

export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    const clear = () => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', clear)
      resolve()
    }, ms)
    signal.addEventListener('abort', clear)
  })
}
