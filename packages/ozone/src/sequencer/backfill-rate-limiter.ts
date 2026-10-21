import assert from 'node:assert'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'

/** Shares a historical label replay budget across subscriptions on one server. */
export class BackfillRateLimiter {
  readonly pageSize: number
  private readonly intervalMs: number
  private nextPageAt = 0

  constructor(eventsPerSecond = 2000) {
    assert(
      Number.isSafeInteger(eventsPerSecond) && eventsPerSecond > 0,
      'Label backfill rate must be a positive integer',
    )
    this.pageSize = Math.min(500, eventsPerSecond)
    this.intervalMs = (1000 * this.pageSize) / eventsPerSecond
  }

  /** Waits for one page of replay work; returns false when cancelled. */
  async wait(signal: AbortSignal): Promise<boolean> {
    while (!signal.aborted) {
      const now = performance.now()
      const waitMs = this.nextPageAt - now
      if (waitMs <= 0) {
        // @NOTE Do not accumulate idle credits: fast readers must not burst
        // through history after the server has been quiet.
        this.nextPageAt = now + this.intervalMs
        return true
      }
      try {
        await delay(waitMs, undefined, { signal })
      } catch (err) {
        if (!signal.aborted) throw err
      }
    }
    return false
  }
}
