# @atproto/ws-client: WebSocket Client Library

An isomorphic WebSocket client for Node and the browser, consumed as an `AsyncIterable` of messages.

[![NPM](https://img.shields.io/npm/v/@atproto/ws-client)](https://www.npmjs.com/package/@atproto/ws-client)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## `WebSocketClient`

`WebSocketClient` is a robust WebSocket client that prioritizes liveness (e.g. via heartbeats), flow control (i.e. backpressure), and handles reconnects transparently — using whatever capabilities are available to it on each platform. You always import from `@atproto/ws-client`; the right platform support is wired in for you.

```ts
import { WebSocketClient } from '@atproto/ws-client'

const ws = new WebSocketClient('wss://jetstream.example.com/subscribe', {
  dataMode: 'text',
})

for await (const message of ws) {
  const event = JSON.parse(message)
  // ... handle event, spanning any number of reconnects
}
```

### Reading messages

`for await` is the read model. The stream spans reconnects, so a consumer never has to notice that the underlying connection was torn down and re-established. There is a single consumer: iterating a second time throws.

Messages are typed by `options.dataMode` (`'auto' | 'text' | 'binary'`, default `'auto'`): `'text'` yields `string`, `'binary'` yields `Uint8Array`, `'auto'` yields either. A strict mode is also enforced at runtime — a frame of the wrong type fails the connection rather than yielding a surprise.

### Lifecycle

Constructing a client opens nothing (`readyState: 'initialized'`). Iteration is what starts it: the first pull opens the connection lazily. Stop it with `close()`, an aborted `options.signal`, or by `break`-ing out of the loop — all three stop it for good.

Lifecycle is observable via `addEventListener`. Register listeners before iterating to catch the first `'open'`:

- `'open'` — the first connection succeeded.
- `'reconnect'` — a later connection succeeded (fires on every reconnect).
- `'error'` — a connection ended with an error. `detail.reconnect` is present (with the attempt count) when the client will retry, absent when it's giving up.
- `'close'` — the client stopped on its own, terminally: a fatal error (right after its `'error'`) or a non-reconnectable clean close. `detail` is `{ code, reason, wasClean }`.

A user-driven stop (`close()` or an aborted `signal`) doesn't dispatch `'close'` — you observe it via `close()` resolving, or the iterator rejecting with your abort reason.

### Reconnects

Failures reconnect with exponential backoff (capped by `options.maxReconnectSeconds`, default 64), and the backoff resets after each successful connection. When the `url` is given as a function, it's re-invoked on every attempt — use that to refresh a cursor or token, e.g. resuming a firehose from the last-seen event.

`options.shouldReconnect` controls which failures reconnect:

- `true` (default) — the built-in policy: transient failures (network errors, timeouts, abnormal closes, server restarts) reconnect; deliberate shutdown (`1000`) and malformed-protocol closes do not. The classification is exported as `FATAL_CLOSE_CODES` and `isReconnectableClose(code)`.
- `false` — never reconnect; the first terminal error ends the stream.
- `(error, attempt) => boolean` — your own policy, replacing the default.

### Liveness

Two independent, optional checks keep a quiet connection honest:

- **Heartbeat** (`options.heartbeat`, default on with a 10s interval, Node only): pings the server and fails the connection if nothing comes back. Any inbound message also counts as life, so a busy connection is never falsely killed. Pass `false` to disable.
- **Idle timeout** (`options.idleTimeoutMs`, off by default, all platforms): fails the connection if no message arrives within the window. For chatty protocols (e.g. a firehose), this is how a browser client — which has no ping/pong API — detects a silently-dead connection and reconnects.

### Flow control

If your consumer falls behind, the client buffers and then pushes back. On Node it pauses the socket once buffered bytes pass `options.highWaterMark`, so backpressure reaches the server for real. The browser can't pause a socket, so `options.maxBufferedBytes` is the backstop there: a hard cap that fails the connection (and reconnects) rather than growing memory without bound.

### Sending

`send(data)` resolves when the data is handed off, and rejects with `WebSocketClientError` if the client isn't currently connected — there's no hidden queueing across reconnects. Check `connected` first, or catch and retry after the next `'reconnect'`.

### Node-only `headers`

`options.headers` (`Record<string, string> | Headers`) is applied to the connection request on Node — useful for `Authorization`. Browsers offer no way to set WebSocket headers, so the option is ignored there; authenticate via the URL or a subprotocol instead. `BrowserWebSocketClientOptions` omits `headers` for option objects that must work on both platforms.

### Errors

`WebSocketClient` throws `WebSocketClientError` for misuse of the client itself (sending while disconnected, iterating twice). Connection-level failures surface through `'error'` events and the iterator rejection as errors from the `WebSocketConnection` taxonomy below.

### Node example: resuming a firehose with headers

```ts
import { WebSocketClient } from '@atproto/ws-client'

let cursor: number | undefined
const url = new URL('wss://jetstream.example.com/subscribe')

const ws = new WebSocketClient(
  () => {
    if (cursor) url.searchParams.set('cursor', String(cursor))
    return url
  },
  {
    dataMode: 'text',
    headers: { Authorization: `Bearer ${process.env.JETSTREAM_TOKEN}` },
  },
)

for await (const message of ws) {
  const event = JSON.parse(message)
  if (event.kind === 'commit') cursor = event.time_us
  // ... handle event
}
```

### Browser example: URL-based auth

```ts
import { WebSocketClient } from '@atproto/ws-client'

const ws = new WebSocketClient(
  `wss://example.com/socket?token=${encodeURIComponent(token)}`,
  { dataMode: 'text', idleTimeoutMs: 30_000 },
)

for await (const message of ws) {
  console.log('received', message)
}
```

## `WebSocketConnection`

`WebSocketConnection` represents a single WebSocket connection — the lower-level primitive that provides the core liveness and flow control functionality leveraged by `WebSocketClient`. It never reconnects: when the connection ends, so does the iterator. Reach for it when you want to handle connection failures yourself.

```ts
import { WebSocketConnection } from '@atproto/ws-client'

const ws = new WebSocketConnection('wss://example.com/socket', {
  dataMode: 'text',
})

for await (const message of ws) {
  // ... handle message
}
```

It shares `WebSocketClient`'s lifecycle and options: construct (no I/O) → iterate (opens lazily) → stop via `close()` / `signal` / `break`. Same `dataMode` typing and enforcement, same heartbeat/idle-timeout and backpressure options, same Node-only `headers`, same `send()` behavior. Differences:

- The stream ends when the connection ends. A clean close (`1000`/`1001`) ends the loop normally; anything else rejects the iterator with a typed error (below).
- Events: `'open'` and `'close'` fire once each; `'error'` fires on failure, always followed by `'close'`. The `'close'` detail carries the real close code when there was one, or `1006` when the connection ended without a close frame.
- `terminate()` tears the connection down immediately, without a close handshake.
- `capabilities` reports what the platform supports: `{ heartbeat, pauseResume }` — both `true` on Node, both `false` in the browser. This is the one observable difference between platforms; the API is otherwise identical.

### Errors

Every connection-level failure is a typed subclass of `WebSocketConnectionError`, so callers classify by `instanceof` rather than string-matching:

| Error                   | Cause                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| `AbnormalCloseError`    | Close with a code other than `1000`/`1001`. Carries `code`, `reason`, `wasClean`. |
| `SocketError`           | A transport-level error. Carries the underlying `cause`.                          |
| `HeartbeatTimeoutError` | No ping/pong activity within the heartbeat window (Node only).                    |
| `IdleTimeoutError`      | No message received within `idleTimeoutMs`.                                       |
| `BufferOverflowError`   | Buffered, unconsumed bytes exceeded `maxBufferedBytes`. Carries `bufferedBytes`.  |
| `DataModeError`         | A frame's type didn't match a strict `dataMode`. Carries `expected`/`received`.   |

## A note for downstream library authors

If your library wraps or re-exports these classes and you bundle your package for distribution, keep `@atproto/ws-client` **external** (not pre-bundled). It resolves to different files on Node vs. the browser through conditional package exports; pre-bundling collapses that choice to a single runtime.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
