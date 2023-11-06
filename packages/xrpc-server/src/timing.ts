import { wait } from '@atproto/common'

export type TimingOpts<A extends [...unknown[]] = []> = {
  constant?: number
  constantExceeded?: (
    info: { duration: number; expected: number },
    ...args: A
  ) => void
}

export function withTiming<T, A extends [...unknown[]], R>(
  fn: (this: T, ...args: A) => R | Promise<R>,
  { constant, constantExceeded }: TimingOpts<A>,
): (this: T, ...args: A) => Promise<R> {
  return async function (...args) {
    const start = Date.now()
    try {
      return await fn.call(this, ...args)
    } finally {
      const duration = Date.now() - start

      if (constant) {
        if (duration < constant) await wait(constant - duration)
        else constantExceeded?.({ duration, expected: constant }, ...args)
      }
    }
  }
}
