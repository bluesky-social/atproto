export type ProxyLimiterOptions = {
  /** 0 = no rate limit */
  maxRequestsPerSecond: number
  /** 0 = no in-flight cap */
  maxConcurrentRequests: number
  maxQueuedRequests: number
  maxQueueMs: number
}

const WINDOW_MS = 1000

export class ProxyLimitExceededError extends Error {
  readonly retryAfterMs: number

  constructor(retryAfterMs: number) {
    super('Too many requests to the upstream service')
    this.name = 'ProxyLimitExceededError'
    this.retryAfterMs = retryAfterMs
  }
}

type Waiter = {
  resolve: (release: () => void) => void
}

/**
 * Limits how fast requests are sent to an upstream service.
 *
 * The rate is a sliding window, not a token bucket: a grant is given only if
 * fewer than `maxRequestsPerSecond` grants were given in the previous second.
 * A token bucket that has filled up lets its whole burst through on top of the
 * steady rate, about twice the configured rate within one second, which is
 * what trips an upstream's per-second limit.
 */
export class ProxyLimiter {
  private readonly opts: ProxyLimiterOptions
  /** Times of the grants still inside the window, oldest first. */
  private grantTimes: number[] = []
  /** Grants given and not yet released. */
  private inFlight = 0
  private queue: Waiter[] = []
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(opts: ProxyLimiterOptions) {
    this.opts = opts
  }

  /**
   * Resolves with a release function once the request may be sent. The caller
   * must call release exactly once when the request has finished.
   */
  acquire(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.opts.maxQueuedRequests) {
        reject(new ProxyLimitExceededError(this.queueDrainMs()))
        return
      }
      this.queue.push({ resolve })
      this.pump()
    })
  }

  /** Estimated time for the current queue to drain at the configured rate. */
  private queueDrainMs(): number {
    return Math.ceil(
      (this.queue.length / this.opts.maxRequestsPerSecond) * WINDOW_MS,
    )
  }

  private pump(): void {
    clearTimeout(this.timer)
    this.timer = undefined

    while (this.queue.length > 0) {
      // No timer needed: the release of an in-flight grant pumps again.
      if (this.inFlight >= this.opts.maxConcurrentRequests) return
      // Monotonic clock: a wall clock step would stall the queue or let a
      // burst through.
      const now = performance.now()
      const wait = this.rateWaitMs(now)
      if (wait > 0) {
        this.timer = setTimeout(() => this.pump(), Math.ceil(wait))
        return
      }
      const waiter = this.queue.shift()
      if (!waiter) return
      this.grantTimes.push(now)
      this.inFlight++
      let released = false
      waiter.resolve(() => {
        // A caller that reports both an end and an error for one request
        // would otherwise free two slots and lift the cap for good.
        if (released) return
        released = true
        this.inFlight--
        this.pump()
      })
    }
  }

  /** How long until the rate allows another grant; 0 when it does now. */
  private rateWaitMs(now: number): number {
    while (
      this.grantTimes.length > 0 &&
      this.grantTimes[0] <= now - WINDOW_MS
    ) {
      this.grantTimes.shift()
    }
    if (this.grantTimes.length < this.opts.maxRequestsPerSecond) return 0
    return this.grantTimes[0] + WINDOW_MS - now
  }
}
