import { setTimeout as sleep } from 'node:timers/promises'
import { Awaitable } from './type.js'

export function onOvertimeDefault(options: {
  start: number
  end: number
  elapsed: number
  time: number
}): void {
  console.warn(
    `constantTime: execution time was ${options.elapsed}ms (which is greater than ${options.time}ms). You should increase the "time" to properly defend against timing attacks.`,
  )
}

/**
 * Utility function to protect against timing attacks.
 */
export async function constantTime<R>(
  time: number,
  fn: () => Awaitable<R>,
  onOvertime = onOvertimeDefault,
): Promise<R> {
  if (!Number.isFinite(time) || time <= 0) {
    throw new TypeError(`"time" must be a positive number`)
  }

  const start = Date.now()
  try {
    return await fn()
  } finally {
    const end = Date.now()
    const elapsed = end - start

    const remaining = time - elapsed
    if (remaining >= 0) {
      // Happy path, execution time was smaller than "time"
      await sleep(remaining)
    } else {
      // The function execution took longer than "time"
      onOvertime({ start, end, elapsed, time })

      // Sleep until the next multiple of "time" to mitigate any attack
      const multiplier = Math.ceil(elapsed / time)
      const remaining = multiplier * time - elapsed

      await sleep(remaining)
    }
  }
}
