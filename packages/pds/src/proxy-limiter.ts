import type { Dispatcher } from 'undici'

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
  expiry?: ReturnType<typeof setTimeout>
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
      const waiter: Waiter = { resolve }
      this.queue.push(waiter)
      this.pump()
      // Pumping only takes from the front, so the new waiter is still queued
      // exactly when it is still last.
      if (this.queue.at(-1) !== waiter) return
      // Checked after pumping so that a request that can be sent now is never
      // turned away by a full (or zero-length) queue.
      if (this.queue.length > this.opts.maxQueuedRequests) {
        this.queue.pop()
        reject(new ProxyLimitExceededError(this.queueDrainMs()))
        return
      }
      waiter.expiry = setTimeout(() => {
        this.queue.splice(this.queue.indexOf(waiter), 1)
        reject(new ProxyLimitExceededError(this.queueDrainMs()))
      }, this.opts.maxQueueMs)
    })
  }

  /** Estimated time for the current queue to drain at the configured rate. */
  private queueDrainMs(): number {
    const rate = this.opts.maxRequestsPerSecond
    if (rate === 0) return WINDOW_MS
    return Math.ceil((this.queue.length / rate) * WINDOW_MS)
  }

  private pump(): void {
    clearTimeout(this.timer)
    this.timer = undefined

    while (this.queue.length > 0) {
      // No timer needed: the release of an in-flight grant pumps again.
      const cap = this.opts.maxConcurrentRequests
      if (cap > 0 && this.inFlight >= cap) return
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
      clearTimeout(waiter.expiry)
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
    if (this.opts.maxRequestsPerSecond === 0) return 0
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

/**
 * An undici interceptor that holds each request until `limiter` grants it.
 * Listed before the retry interceptor in `compose()`, it sees every attempt,
 * so retries count against the limit too.
 */
export function limiterInterceptor(
  limiter: ProxyLimiter,
): Dispatcher.DispatcherComposeInterceptor {
  return (dispatch) => (opts, handler) => {
    void limiter.acquire().then((release) => {
      dispatch(opts, releasingHandler(handler, release))
    })
    return true
  }
}

function releasingHandler(
  handler: Dispatcher.DispatchHandler,
  release: () => void,
): Dispatcher.DispatchHandler {
  return {
    onRequestStart: (controller, context) =>
      handler.onRequestStart?.(controller, context),
    onRequestUpgrade: (controller, statusCode, headers, socket) =>
      handler.onRequestUpgrade?.(controller, statusCode, headers, socket),
    onResponseStart: (controller, statusCode, headers, statusMessage) =>
      handler.onResponseStart?.(controller, statusCode, headers, statusMessage),
    onResponseData: (controller, chunk) =>
      handler.onResponseData?.(controller, chunk),
    onResponseEnd: (controller, trailers) => {
      release()
      handler.onResponseEnd?.(controller, trailers)
    },
    onResponseError: (controller, error) =>
      handler.onResponseError?.(controller, error),
    onResponseStarted: () => handler.onResponseStarted?.(),
    onBodySent: (chunk) => handler.onBodySent?.(chunk),
    onRequestSent: () => handler.onRequestSent?.(),
  }
}
