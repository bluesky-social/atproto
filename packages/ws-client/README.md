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
