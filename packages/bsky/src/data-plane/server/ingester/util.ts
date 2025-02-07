import assert from 'node:assert'
import { Redis } from '../../../redis'
import { dataplaneLogger as logger } from '../../../logger'

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
      assert(
        len < highWaterMark,
        `stream length hit high water mark: ${len} (${highWaterMark})`,
      )
      lastLengthCheck = now
    } catch (err) {
      logger.error({ err }, 'stream length check failed')
      await wait(5000, signal)
      await checkLength(signal)
    }
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
