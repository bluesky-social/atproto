# @atproto/ws-client: WebSocket Client Library

An isomorphic WebSocket client for a single long-lived connection, consumed
as an `AsyncIterable` of messages. The same `WebSocketCore` API works in
Node (via [`ws`](https://www.npmjs.com/package/ws)) and in the browser (via
the native `WebSocket`), through conditional package exports — you always
import from `@atproto/ws-client`, and the right transport is wired in for
you.

[![NPM](https://img.shields.io/npm/v/@atproto/ws-client)](https://www.npmjs.com/package/@atproto/ws-client)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## `WebSocketCore`

```ts
import { WebSocketCore } from '@atproto/ws-client'

const ws = new WebSocketCore('wss://jetstream.example.com/subscribe', {
  dataMode: 'text',
})

for await (const message of ws) {
  const event = JSON.parse(message)
  // ... handle event
}
```

### Reading messages

`WebSocketCore` implements `AsyncIterable`, so `for await` is the read
model. There is a single consumer: iterating a second time (or iterating
concurrently) throws. When the connection ends cleanly (close code `1000`
or `1001`), the loop exits normally; any other close or socket error
rejects the iterator with an error from the taxonomy below. An aborted
`signal` rejects the iterator with the AbortSignal's own `reason` (the
value passed to `controller.abort(reason)`, or a `DOMException` named
`AbortError` if no reason was given). Messages received before a consumer
starts iterating are buffered and delivered in order once iteration begins.

### `dataMode`

`WebSocketCoreOptions#dataMode` is `'auto' | 'text' | 'binary'` (default
`'auto'`), and it also types what the iterator yields via `MessageOf<M>`:

- `'auto'` — messages yield as `string | Uint8Array`, whichever the frame
  actually was.
- `'text'` — messages yield as `string`; a binary frame is a protocol
  violation and fails the connection with `DataModeError`.
- `'binary'` — messages yield as `Uint8Array`; a text frame likewise fails
  with `DataModeError`.

`dataMode` is enforced at intake on both transports, so a `'binary'`
consumer never has to check `typeof message` — the type and the runtime
behavior agree.

### Capabilities

Node and the browser differ in what the underlying transport can actually
do; `WebSocketCore#capabilities` is the one place that difference is
observable (everything else about the API is identical across entries):

```ts
ws.capabilities
// Node:    { heartbeat: true,  pauseResume: true  }
// Browser: { heartbeat: false, pauseResume: false }
```

- `heartbeat` — whether the transport can send protocol pings and observe
  pongs (Node only; the browser has no ping/pong API).
- `pauseResume` — whether the transport can exert real read-side
  backpressure by pausing the underlying socket (Node only).

### Lifecycle: `opened` / `closed`

`ws.opened` resolves once the connection is established, and `ws.closed`
resolves with `{ code, reason }` on a clean close. Both reject on failure.
They're pre-attached with a no-op rejection handler internally, so it's
safe to construct a `WebSocketCore` and never await either promise without
triggering an unhandled rejection warning.

### `send` / `close` / `terminate`

- `send(data)` — returns a `Promise<void>`. On Node it resolves once `ws`
  reports the write flushed to the OS. **In the browser it resolves as
  soon as the native `WebSocket.send` call returns** — i.e. once the
  transport accepted the data, not once it's actually on the wire; the
  browser gives no lower-level flush signal.
- `close(code?, reason?)` — requests a clean close and returns a promise
  that settles with `ws.closed`.
- `terminate()` — an immediate, non-graceful teardown. On Node this is a
  hard socket destroy; in the browser (which has no RST equivalent) it's
  the strongest teardown available, a `close()` call.

### Heartbeat vs. idle timeout

These are independent, optional liveness checks:

- **Heartbeat** (`options.heartbeat`, default `{ intervalMs: 10_000 }`,
  Node only — gated on `capabilities.heartbeat`): each tick, if no message
  or pong was observed since the previous tick, the connection fails with
  `HeartbeatTimeoutError`; otherwise it sends a fresh ping. Detection
  latency is one to two intervals. Pass `heartbeat: false` to disable.
- **Idle timeout** (`options.idleTimeoutMs`, disabled by default, works on
  both transports): each tick, if no _message_ was received since the
  previous tick, the connection fails with `IdleTimeoutError`. A pong does
  **not** count as activity for this timer — it's tracking application
  traffic, not raw socket liveness.

Both timers are `unref()`'d on Node so they never keep the process alive.

### Errors

All errors extend `WebSocketCoreError`:

| Error                   | Cause                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| `AbnormalCloseError`    | Close with a code other than `1000`/`1001`. Carries `code`, `reason`, `wasClean`. |
| `SocketError`           | A transport-level error event. Carries the underlying `cause`.                    |
| `HeartbeatTimeoutError` | No ping/pong activity within the heartbeat window (Node only).                    |
| `IdleTimeoutError`      | No message received within `idleTimeoutMs`.                                       |
| `BufferOverflowError`   | Buffered, unconsumed bytes exceeded `maxBufferedBytes`. Carries `bufferedBytes`.  |
| `DataModeError`         | A frame's type didn't match a strict `dataMode`. Carries `expected`/`received`.   |

Backpressure options `highWaterMark` (pause the read side once buffered
bytes exceed this) and `maxBufferedBytes` (hard cap — crash rather than
grow unbounded) round out `WebSocketCoreOptions`; on the browser, where
`capabilities.pauseResume` is `false`, only the hard cap applies.

### Browser example

```ts
import { WebSocketCore } from '@atproto/ws-client'

const ws = new WebSocketCore('wss://example.com/socket', { dataMode: 'text' })
await ws.opened
await ws.send(JSON.stringify({ hello: 'world' }))

try {
  for await (const message of ws) {
    console.log('received', message)
  }
} catch (err) {
  console.error('connection failed', err)
}
```

## `ReconnectingWebSocket`

`ReconnectingWebSocket` wraps `WebSocketCore` with an automatic reconnect
loop, while presenting the same `AsyncIterable` read model — `for await`
transparently spans reconnects, so a consumer never has to notice that the
underlying connection was torn down and re-established.

```ts
import { ReconnectingWebSocket } from '@atproto/ws-client'

const ws = new ReconnectingWebSocket(
  'wss://jetstream.example.com/subscribe',
  { dataMode: 'text' },
)

for await (const message of ws) {
  const event = JSON.parse(message)
  // ... handle event, spanning any number of reconnects
}
```

### Constructing

`new ReconnectingWebSocket(url, options)` — `url` is a `string | URL`, or a
thunk `() => string | URL | Promise<string | URL>` that's re-invoked on
every (re)connect attempt. Use the thunk form to refresh a cursor, token, or
other query param each time — e.g. resuming a firehose from the last-seen
event after a drop. `options.dataMode` (`'auto' | 'text' | 'binary'`,
default `'auto'`) is forwarded to the underlying core and, as with
`WebSocketCore`, types what the iterator yields via `MessageOf<M>`.

### Node-only `headers`

`options.headers` (`Record<string, string> | Headers`) is applied to the
underlying `ws` connection on Node. It's ignored in the browser build — the
native `WebSocket` API has no request-header mechanism — so browser
consumers authenticate via the URL (query param, cookie) or a subprotocol
instead. `BrowserReconnectingOptions` omits `headers` entirely for
`satisfies`-style option objects that must work on both entries.

### Browser backstops: `maxBufferedBytes` and `idleTimeoutMs`

Both options are forwarded to the core on every (re)connect, and both exist
because the browser transport lacks capabilities the Node transport has:

- `maxBufferedBytes` is the hard cap on unconsumed buffered bytes. On Node,
  exceeding `highWaterMark` first pauses the socket for real backpressure;
  the browser has no such pause/resume, so `maxBufferedBytes` is its only
  backstop — crossing it fails the connection with `BufferOverflowError`,
  which the default policy reconnects from.
- `idleTimeoutMs` fails the connection with `IdleTimeoutError` if no message
  arrives within the window. The browser has no ping/pong heartbeat API, so
  for chatty protocols (e.g. a firehose) this is how a browser client
  detects a silently-dead connection and reconnects.

### Lifecycle callbacks

- `onOpen({ reconnect })` — fires after each successful (re)open;
  `reconnect` is `false` for the first connection and `true` thereafter.
- `onError(error, { willReconnect, attempt })` — fires when a connection
  ends with an error, before the loop decides whether to sleep-and-retry or
  give up; `attempt` is the consecutive-failure count since the last
  successful open.

### Reconnect policy

By default, a connection failure or close reconnects unless the close code
is genuinely fatal. `FATAL_CLOSE_CODES` (`1000, 1002, 1003, 1007, 1009`) and
`isReconnectableClose(code)` are exported so callers can inspect or reuse
the same classification. Only close codes a peer can deliberately put on
the wire to mean normal shutdown (`1000`) or a malformed-protocol condition
(`1002`/`1003`/`1007`/`1009`) are fatal; the synthetic codes a runtime
generates locally to describe transient trouble (`1005` no-status, `1006`
abnormal, `1015` TLS) are reconnectable, matching how the same failures
surface as `SocketError` on the other transport. Pass
`shouldReconnect(error, attempt)` to override the classification for any
error, including a synthetic `AbnormalCloseError` used internally to
reclassify clean close codes.

### `send` / `connected` / `close` / `signal`

- `send(data)` rejects immediately if not currently connected (no
  queueing across a reconnect) — check `connected` first, or catch and
  retry once the next `onOpen` fires.
- `connected` is `true` only while the current underlying core reports
  `readyState === 'open'`.
- `close(code?, reason?)` stops the reconnect loop for good and closes the
  current connection cleanly; the async iterator then completes normally.
- `options.signal` (`AbortSignal`) ends the reconnect loop permanently on
  abort, rejecting the iterator with the signal's abort reason — use this
  for caller-driven shutdown instead of `close()` when you already have a
  signal wired through your application.

### Node example: Jetstream-style consumer with headers

```ts
import { ReconnectingWebSocket } from '@atproto/ws-client'

let cursor: number | undefined
const url = new URL('wss://jetstream.example.com/subscribe')

const ws = new ReconnectingWebSocket(
  () => {
    if (cursor) url.searchParams.set('cursor', String(cursor))
    return url
  },
  {
    dataMode: 'text',
    headers: { Authorization: `Bearer ${process.env.JETSTREAM_TOKEN}` },
    onError: (error, { willReconnect, attempt }) =>
      console.warn('jetstream error', { willReconnect, attempt }, error),
  },
)

for await (const message of ws) {
  const event = JSON.parse(message)
  if (event.kind === 'commit') cursor = event.time_us
  // ... handle event
}
```

### Browser example: URL-based auth, no headers

```ts
import { ReconnectingWebSocket } from '@atproto/ws-client'

const ws = new ReconnectingWebSocket(
  `wss://example.com/socket?token=${encodeURIComponent(token)}`,
  { dataMode: 'text', idleTimeoutMs: 30_000 },
)

for await (const message of ws) {
  console.log('received', message)
}
```

### A note for downstream library authors

If your library re-exports or wraps `ReconnectingWebSocket`/`WebSocketCore`
and you bundle your own package for distribution, keep `@atproto/ws-client`
**external** (not pre-bundled). It resolves to different files on Node vs.
the browser through conditional package exports; pre-bundling it into a
single output collapses that choice to whatever the bundler picked at
build time, breaking resolution for whichever runtime it didn't choose.

## `WebSocketKeepAlive` (Node)

`WebSocketKeepAlive` is a legacy, reconnecting client and remains available
on Node, unchanged. It will be reimplemented on top of `WebSocketCore` in a
follow-up; until then, the browser entry exports a stub of the same name
that throws on construction (kept only so both entries export the same
names — see `tests/entries.test.ts`).

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
