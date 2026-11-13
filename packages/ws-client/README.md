# @atproto/ws-client: WebSocket Client Library

A WebSocket client hardened for long-lived streams

[![NPM](https://img.shields.io/npm/v/@atproto/ws-client)](https://www.npmjs.com/package/@atproto/ws-client)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Install

```sh
npm install @atproto/ws-client
```

## Overview

The package provides a WebSocket client `websocket(url, options?)` as an async iterable. It connects, reads messages, reconnects on failure, and yields one continuous stream.

Beyond reading, it covers the concerns a long-lived stream runs into in practice: liveness (a heartbeat and an idle timeout to detect dead connections), flow control (real socket backpressure on Node.js, plus a hard cap on buffered bytes), reconnect classification by close code and error type, and lifecycle hooks. It works on Node.js and in the browser.

```ts
import { websocket } from '@atproto/ws-client'

for await (const message of websocket('wss://example.com/feed')) {
  console.log(message)
}
```

The loop runs across reconnects: if the connection drops and a retry succeeds, iteration continues, and the consumer never sees the gap as a separate stream. A message is a `string` or `Uint8Array` depending on the frame's wire type, unless narrowed by `dataMode` (see below).

### `dataMode`

`dataMode: 'auto' | 'text' | 'binary'` (default `'auto'`) both types what's yielded and is enforced at runtime:

```ts
// message: string
for await (const message of websocket(url, { dataMode: 'text' })) { ... }

// message: Uint8Array
for await (const message of websocket(url, { dataMode: 'binary' })) { ... }
```

If the server sends a frame of the wrong type under `'text'` or `'binary'`, the stream ends with a `DataModeError` (non-retryable — a protocol mismatch will recur) rather than silently coercing the data.

## Lifecycle

A stream ends in one of two ways: you `break` (or `return`/`throw`) out of the loop, or you abort a `signal` passed in `options`.

```ts
const controller = new AbortController()
const gen = websocket(url, { signal: controller.signal })

// later, from elsewhere:
controller.abort()
```

Stopping always closes the socket politely — it's a request to stop, not a failure — and the abort reason is how you choose the close code:

| how you stop                          | what the peer sees           |
| ------------------------------------- | ---------------------------- |
| `break`/`throw` in the loop           | close `1000`                 |
| `controller.abort()` (no argument)    | close `1000`                 |
| `controller.abort(new CloseError(…))` | close with that error's code |
| `controller.abort(anythingElse)`      | close `1000`                 |

The last row matters for shutdown paths: `controller.abort(new Error('SIGTERM'))` is a deliberate stop, so the peer still gets a clean goodbye. The reason isn't lost — it's what the iterator rejects with. `break` and `throw` are indistinguishable to a generator, so they share the plain clean close.

**In the browser, a `CloseError`'s code carries through only if the platform permits it.** The WHATWG API accepts `1000` and the private-use range `3000`–`4999`, and throws on anything else — the rest of the RFC 6455 codes are reserved for the protocol itself to send, even though an endpoint may legitimately receive them. A code outside that set closes with `1000` instead, so pick from `3000`–`4999` for application-specific codes that need to reach a browser peer. Node.js has no such restriction and sends any code as given.

A non-reconnectable `1000` close — the server says it's done and the reconnect policy declines to retry — ends the stream normally: the loop just finishes, same as `break`. Every other end rejects the iterator, including a fatal protocol close such as `1002`, a network failure, or an aborted signal. Wrap the loop in `try`/`catch` if you need to distinguish "the peer said goodbye" from "something went wrong."

```ts
try {
  for await (const message of websocket(url)) {
    handle(message)
  }
  // stream ended cleanly
} catch (err) {
  // stream ended abnormally
}
```

## Reconnects

By default a dropped connection is retried with jittered exponential backoff, capped by `maxReconnectSeconds` (default `64`), and the backoff resets to its base after each connection that opens.

- `url` may be a function: `() => string | URL | Promise<string | URL>`. It's re-invoked on every attempt, including reconnects — the idiom for resuming a stream at a cursor (see the firehose example below).
- `shouldReconnect` controls whether a failure is retried:
  - `true` (default) — the built-in policy: each typed error self-classifies, and close codes are classified per RFC 6455.
  - `false` — never reconnect; the first end is terminal.
  - `(error, attempt) => boolean` — replaces the default classification.

```ts
websocket(url, {
  shouldReconnect: (error, attempt) => attempt < 5,
})
```

Hooks observe the lifecycle at two levels. `onOpen()` and `onClose(detail)` bookend the **stream**, once each; `onConnect(sender)` and `onDisconnect()` bookend each **connection**, as many times as it takes.

| hook                              | when                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| `onOpen()`                        | the stream is live, once, just before the first `onConnect` |
| `onConnect(sender)`               | a connection is up — including the first                    |
| `onDisconnect()`                  | that connection ended                                       |
| `onReconnect(error, { attempt })` | a connection failed and a retry is coming                   |
| `onError(error)`                  | a connection failed and the stream is giving up             |
| `onClose(detail)`                 | the stream ended, once, after the local socket has closed   |

`onReconnect` and `onError` are exclusive, and the split matters: an `onReconnect` error is swallowed by the retry, so that hook is the _only_ place transient trouble surfaces. An `onError` error is also what the iterator rejects with, so you can handle it there or in a `catch` around the loop.

`onConnect` and `onDisconnect` pair exactly, and a dial that never connected produces neither. So a stream stuck retrying reports one `onDisconnect` for the connection it lost and an `onReconnect` per failed attempt.

`onDisconnect`, not `onReconnect`, is where to stop using a `sender`: the loop only advances when the consumer pulls, so `onReconnect` can arrive well after the socket died.

`onClose` fires only once the local socket is closed, so it's safe to treat as "teardown is done" and release whatever the stream depended on. The end of the `for await` carries the same guarantee: iteration doesn't settle until the socket is down, so awaiting the loop is enough — you don't need the hook to sequence a shutdown.

A polite close waits for the peer to answer, so on Node.js that wait is capped at one second (after which the socket is destroyed and reported as an abnormal `1006`) rather than the 30 seconds `ws` allows by default.

`wasClean: true` means the closing handshake completed — both sides exchanged close frames — not that the close was a `1000`. A `1002` protocol close is reported clean, and still rejects the iterator; the reconnect policy keys on the close code, never on this flag.

## Liveness

Two independent mechanisms detect a dead connection that hasn't told you so:

- **Heartbeat** (Node.js only): `heartbeat: { intervalMs }` pings each interval and accepts any inbound frame, not just a pong, as evidence of life. A missed round becomes a `HeartbeatTimeoutError` and a reconnect. The browser's WebSocket API has no ping/pong, so this option is ignored there.
- **Idle timeout** (both platforms): `idleTimeoutMs` ends the connection with an `IdleTimeoutError` if no message arrives within the window. This is the browser's only dead-connection detector, so set it there if you need one.

Only the Node case is on by default: `heartbeat` defaults to a 10s interval (pass `heartbeat: false` to disable, or `{ intervalMs }` to change it), while `idleTimeoutMs` is off unless you set it.

**A connection that fails discards whatever it had buffered but undelivered.** A liveness timeout, a byte-cap overflow, or a transport error drops those messages rather than yielding data from a connection already known to be broken; a _clean_ close still drains what arrived before it. For cursor-based streams that's harmless, since a reconnect resumes from the cursor. If your stream isn't resumable, keep `highWaterMark` low enough that little is ever in flight.

## Flow control

- **Node.js**: real socket backpressure. Past `highWaterMark` (default 1 MiB of buffered, unread bytes) the socket is paused until the consumer catches up.
- **Both platforms**: `maxBufferedBytes` is a hard cap. Exceeding it fails the connection with a `BufferOverflowError` (non-retryable) rather than growing the buffer without bound. It's the _only_ backstop in the browser, since the WHATWG API gives no way to pause a socket.

Both thresholds count **received, unread** bytes — there is only one buffer in this library, and nothing bounds the write side. They count binary frames exactly and **over-estimate text**: a string is measured as UTF-16 code units × 2, which avoids an encode per message but counts mostly-ASCII text at roughly twice its wire size. Both are safety valves, so pausing or failing early is the safer direction to err — just don't read them as exact wire bytes when sizing them for a text stream.

Overflow is fatal by default, on the reasoning that a consumer which fell behind once will fall behind again. If your stream is resumable — a cursor-based feed, say — you can opt into retrying it, which is worth considering in the browser where there's no backpressure to lean on:

```ts
import {
  BufferOverflowError,
  defaultShouldReconnect,
  websocket,
} from '@atproto/ws-client'

websocket(url, {
  maxBufferedBytes: 10 * 1024 * 1024,
  shouldReconnect: (error) =>
    error instanceof BufferOverflowError || defaultShouldReconnect(error),
})
```

Whatever was buffered is discarded, so only reconnect on overflow if you can resume from where you left off.

## Compression

`permessage-deflate` is offered by default on both platforms. There's no option to configure or disable it.

## Sending

`websocket()` yields messages; sending goes through the `sender` handed to `onConnect`. A sender belongs to one connection and rejects once that connection ends, so always use the most recent one rather than retaining an older:

```ts
import { type Sender, websocket } from '@atproto/ws-client'

let sender: Sender<'text'> | undefined

const stream = websocket(url, {
  dataMode: 'text',
  onConnect: (s) => {
    sender = s
  },
  onDisconnect: () => {
    sender = undefined
  },
})

for await (const message of stream) {
  const event = JSON.parse(message)
  await handle(event)
  await sender?.send(JSON.stringify({ type: 'ack', id: event.id }))
}
```

`send()` resolves on hand-off and not on delivery: flushed on Node.js or accepted by the browser's WebSocket.

If you need at-least-once delivery, handle that within the application. If a message needs to be sent when there isn't an active sender, it can be queued then later flushed from `onConnect`.

## Headers (Node.js only)

```ts
websocket(url, { headers: { Authorization: `Bearer ${token}` } })
```

`headers` applies to the connection's upgrade request. It's Node.js-only: the WHATWG API used in the browser has no way to set request headers, so passing `headers` there throws at construction rather than silently dropping what is usually an auth credential. `BrowserWebSocketOptions` omits the field entirely, so it's also a compile-time error if you import the browser-specific option type.

## Errors

Every failure is a `WebSocketClientError`, and each subclass classifies itself via `shouldRetry()` — which is what the default reconnect policy consults:

| Error                   | Meaning                                                    | Retryable by default                |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `CloseError`            | The connection closed with a given code/reason/cleanliness | Classified by close code (RFC 6455) |
| `SocketError`           | A transport-level failure (e.g. connection refused)        | Yes                                 |
| `HeartbeatTimeoutError` | No frame observed within the heartbeat window (Node.js)    | Yes                                 |
| `IdleTimeoutError`      | No message arrived within `idleTimeoutMs`                  | Yes                                 |
| `BufferOverflowError`   | Buffered bytes exceeded `maxBufferedBytes`                 | No                                  |
| `DataModeError`         | A frame's type didn't match `dataMode`                     | No                                  |

A bare `WebSocketClientError` marks misuse of the API itself, like sending on a closed connection, and is never retryable.

## Examples

### Resuming a firehose from a cursor

A function-valued `url` is re-invoked on every attempt, including reconnects. Read the latest cursor at call time so a reconnect resumes where the last connection left off instead of restarting the stream:

```ts
import { websocket } from '@atproto/ws-client'

let cursor: string | undefined

const stream = websocket(() => {
  const url = new URL('wss://example.com/subscribe')
  if (cursor) url.searchParams.set('cursor', cursor)
  return url
})

for await (const message of stream) {
  cursor = extractCursor(message)
  handle(message)
}
```

### A browser client with an idle timeout

The browser has no heartbeat mechanism, so `idleTimeoutMs` is its only way to detect a connection that has silently gone dead:

```ts
import { websocket } from '@atproto/ws-client'

try {
  for await (const message of websocket('wss://example.com/feed', {
    idleTimeoutMs: 30_000,
  })) {
    render(message)
  }
} catch (err) {
  showDisconnected(err)
}
```

## A note for library authors: keep this package external

This package selects its transport (Node vs. browser) via a conditional `imports` entry (`#transport`) that the runtime resolves at import time. If you pre-bundle it into a library's output, that resolution collapses to whichever transport your bundler's target picked, and the result won't adapt to the environment it actually runs in. Mark `@atproto/ws-client` as external so each consumer's own runtime resolves the transport.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
