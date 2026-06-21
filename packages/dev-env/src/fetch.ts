import {
  Agent,
  Dispatcher,
  RequestInfo,
  RequestInit,
  fetch as undiciFetch,
} from 'undici'

/**
 * An undici {@link Agent} tuned for tests: it pools connections (so several
 * requests can run in parallel) and keeps them alive briefly so they can be
 * reused, but with a short idle timeout. The pool is force-closed on teardown
 * via {@link TestFetch.destroy}, so this timeout only governs reuse during a
 * run — it is kept well under the 10s `afterAll` budget as a safety net.
 */
const createTestDispatcher = (): Agent =>
  new Agent({
    // Allow multiple concurrent connections per origin (parallelism).
    connections: 128,
    // Idle timeout before an unused socket is closed. Default is 4s; we lower
    // it to 1s so leftover sockets disappear quickly while still allowing reuse
    // across the back-to-back requests a test typically makes.
    keepAliveTimeout: 1_000,
    // Upper bound undici will honor for a server-advertised keep-alive hint
    // (via the `keep-alive` header). Default is 600s; we cap it at 2s so a
    // server promising a long-lived connection can't keep our sockets open
    // anywhere near the 10s `afterAll` budget.
    keepAliveMaxTimeout: 2_000,
  })

/**
 * Wraps undici's `fetch` so that requests are routed through the provided
 * undici {@link Dispatcher}.
 *
 * We intentionally use undici's own `fetch` rather than `globalThis.fetch`:
 * Node's built-in `fetch` is backed by the undici version bundled with the
 * runtime, which may differ from the one this package depends on. Passing a
 * dispatcher created here to a `fetch` backed by a different undici version
 * throws `InvalidArgumentError: invalid onRequestStart method`, because the
 * internal request-handler interface changed between versions.
 *
 * For the same cross-version reason, undici's `fetch` only accepts a string,
 * `URL`, or *its own* `Request` class — a global `Request` (e.g. the one
 * `@atproto/api` builds) is stringified to `"[object Request]"`. We therefore
 * destructure a global `Request` into a `(url, init)` pair, forwarding the body
 * as a stream (`duplex: 'half'`) so it is never buffered or assumed consumed.
 */
const dispatcherFetch =
  (dispatcher: Dispatcher): typeof globalThis.fetch =>
  (input, init) => {
    if (input instanceof Request) {
      return undiciFetch(input.url, {
        method: input.method,
        headers: [...input.headers],
        body: input.body,
        duplex: input.body ? 'half' : undefined,
        signal: input.signal,
        ...init,
        dispatcher,
      } as unknown as RequestInit) as unknown as Promise<Response>
    }
    return undiciFetch(
      input as unknown as RequestInfo,
      {
        ...init,
        dispatcher,
      } as unknown as RequestInit,
    ) as unknown as Promise<Response>
  }

export type TestFetch = typeof globalThis.fetch & {
  /** Closes the underlying connection pool. */
  destroy: () => Promise<void>
}

/**
 * Creates a `fetch` implementation backed by a pooled, non-keep-alive
 * dispatcher, plus a `destroy()` method to close it.
 *
 * Why this is needed: a bare `server.close()` only resolves once all
 * connections are closed, and it does NOT force-close idle HTTP keep-alive
 * sockets — they linger until the server's `keepAliveTimeout` (Node default
 * ~5s) elapses. With several services closing in sequence, those waits add up
 * and can blow past Vitest's 10s hook timeout, producing flaky teardowns on CI.
 *
 * Note: the `connection: close` request header cannot be used to achieve this.
 * `connection` is a forbidden header name in the fetch spec, so undici silently
 * drops it and keeps reusing pooled keep-alive connections.
 */
export const createTestFetch = (): TestFetch => {
  const dispatcher = createTestDispatcher()
  const fetch = dispatcherFetch(dispatcher)
  return Object.assign(fetch, { destroy: () => dispatcher.destroy() })
}
