import { Agent, Dispatcher } from 'undici'

/**
 * An undici {@link Agent} tuned for tests: it still pools connections (so
 * several requests can run in parallel), but closes idle connections almost
 * immediately instead of keeping them alive.
 */
const createTestDispatcher = (): Agent =>
  new Agent({
    // Allow multiple concurrent connections per origin (parallelism).
    connections: 128,
    // Effectively disable keep-alive: drop sockets as soon as they go idle.
    keepAliveTimeout: 1,
    keepAliveMaxTimeout: 1,
  })

/**
 * Wraps `globalThis.fetch` so that requests are routed through the provided
 * undici {@link Dispatcher}.
 */
const dispatcherFetch =
  (dispatcher: Dispatcher): typeof globalThis.fetch =>
  (input, init) =>
    // `dispatcher` is supported by Node's undici-based `fetch` at runtime, but
    // isn't part of the DOM `RequestInit` type (and the bundled undici types
    // may differ in version), hence the cast.
    globalThis.fetch(input, { ...init, dispatcher } as unknown as RequestInit)

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
