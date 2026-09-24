import { Transform, type TransformCallback } from 'node:stream'
import { safeFetchWrap } from '@atproto-labs/fetch-node'

const DEFAULT_RESPONSE_MAX_SIZE = 10 * 1024 * 1024

export const createSafeFetch = ({
  timeout = Infinity,
  responseMaxSize = DEFAULT_RESPONSE_MAX_SIZE,
}: {
  timeout?: number
  responseMaxSize?: number
} = {}) => {
  const safeFetch = safeFetchWrap({
    allowCustomPort: true,
    allowImplicitRedirect: true,
    allowIpHost: false,
    responseMaxSize,
    timeout,
  })

  return (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
    safeFetch(input, { ...init, redirect: 'error' })
}

export class BodyTimeoutTransform extends Transform {
  private timer: NodeJS.Timeout | undefined

  constructor(private readonly timeout: number) {
    super()
    this.resetTimer()
  }

  override _transform(
    chunk: unknown,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    this.resetTimer()
    callback(null, chunk)
  }

  override _flush(callback: TransformCallback) {
    this.clearTimer()
    callback()
  }

  override _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void,
  ) {
    this.clearTimer()
    callback(error)
  }

  private resetTimer() {
    this.clearTimer()
    this.timer = setTimeout(
      () => this.destroy(new Error('Blob body timeout')),
      this.timeout,
    )
    this.timer.unref()
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }
}
