import type { Dispatcher } from 'undici'

export type ProxyLimiterOptions = {
  /** 0 = no rate limit */
  maxRequestsPerSecond: number
  /** 0 = no in-flight cap */
  maxConcurrentRequests: number
  maxQueuedRequests: number
  maxQueueMs: number
}

/** Told what the limiter did with each request, for metrics. */
export type ProxyLimiterObserver = {
  /** `waitMs` is 0 for a request that was granted without queuing. */
  granted(waitMs: number): void
  rejected(reason: 'queue_full' | 'queue_timeout'): void
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
  /** Set once the request had to queue. */
  queuedAt?: number
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
  private readonly observer: ProxyLimiterObserver | undefined
  /** Times of the grants still inside the window, oldest first. */
  protected grantTimes: number[] = []
  /** Grants given and not yet released. */
  private inFlight = 0
  private queue: Waiter[] = []
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(opts: ProxyLimiterOptions, observer?: ProxyLimiterObserver) {
    this.opts = opts
    this.observer = observer
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
        this.report((o) => o.rejected('queue_full'))
        reject(new ProxyLimitExceededError(this.queueDrainMs()))
        return
      }
      waiter.queuedAt = performance.now()
      waiter.expiry = setTimeout(() => {
        this.queue.splice(this.queue.indexOf(waiter), 1)
        this.report((o) => o.rejected('queue_timeout'))
        reject(new ProxyLimitExceededError(this.queueDrainMs()))
      }, this.opts.maxQueueMs)
    })
  }

  /**
   * An observer that throws must not change what happens to a request: a
   * throw between counting a grant and handing it out would leak the slot.
   */
  private report(event: (observer: ProxyLimiterObserver) => void): void {
    if (!this.observer) return
    try {
      event(this.observer)
    } catch {
      // Metrics only: there is nothing useful to do with the failure here.
    }
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
      // With no rate limit nothing reads or prunes these, so recording them
      // would grow without bound.
      if (this.opts.maxRequestsPerSecond > 0) this.grantTimes.push(now)
      this.inFlight++
      const waitMs = waiter.queuedAt === undefined ? 0 : now - waiter.queuedAt
      this.report((o) => o.granted(waitMs))
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
    limiter.acquire().then(
      (release) => {
        dispatch(opts, releasingHandler(handler, release))
      },
      (cause: unknown) => {
        const error =
          cause instanceof Error ? cause : new Error('Proxy limiter failed')
        handler.onResponseError?.(neverSentController(error), error)
      },
    )
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
    onResponseError: (controller, error) => {
      release()
      handler.onResponseError?.(controller, error)
    },
    onResponseStarted: () => handler.onResponseStarted?.(),
    onBodySent: (chunk) => handler.onBodySent?.(chunk),
    onRequestSent: () => handler.onRequestSent?.(),
  }
}

/**
 * The controller handed to `onResponseError` for a request that was never
 * dispatched: there is nothing to pause, resume or abort.
 */
function neverSentController(reason: Error): Dispatcher.DispatchController {
  return {
    aborted: true,
    paused: false,
    reason,
    abort: () => {},
    pause: () => {},
    resume: () => {},
  }
}

/**
 * A `fetch` that holds each call until `limiter` grants it, for the requests
 * that do not go through an undici agent with {@link limiterInterceptor}.
 *
 * The slot is freed when `fetch` settles, which is when the response headers
 * arrive, not when the body has been read: a caller that never reads the body
 * would otherwise keep its slot for good.
 */
export function limiterFetch(
  limiter: ProxyLimiter,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): typeof globalThis.fetch {
  return async (input, init) => {
    const release = await limiter.acquire()
    try {
      return await fetch(input, init)
    } finally {
      release()
    }
  }
}
