# @atproto/ws-client: WebSocket Client Library

A reconnecting WebSocket client for reading long-lived streams — the same
code path on Node.js and in the browser. Reading is an `AsyncIterable` that
spans reconnects transparently, backed by a typed error taxonomy and
close-code-aware reconnect classification.

[![NPM](https://img.shields.io/npm/v/@atproto/ws-client)](https://www.npmjs.com/package/@atproto/ws-client)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Install

```sh
npm install @atproto/ws-client
```

## Overview

The package exports two things:

- **`websocket(url, options?)`** — an async generator. This is the primary
  API: connect, read messages, reconnect on failure, and yield a single
  continuous stream to the consumer regardless of how many times the
  underlying socket was replaced.
- **`WebSocketClient`** — a thin class wrapping `websocket()` that adds a
  bounded send queue, so you can call `send()` before the first connection
  opens or during a reconnect gap.

Everything else (error classes, `CloseCode`, option types) supports one of
these two entrypoints.

## Reading

```ts
import { websocket } from '@atproto/ws-client'

for await (const message of websocket('wss://example.com/feed')) {
  console.log(message)
}
```

The `for await` loop runs across reconnects: if the connection drops and a
retry succeeds, iteration just continues — the consumer never sees the gap
as a separate stream. A message is a `string` or `Uint8Array` depending on
the frame's wire type, unless narrowed by `dataMode` (below).

### `dataMode`

`dataMode: 'auto' | 'text' | 'binary'` (default `'auto'`) both types what's
yielded and is enforced at runtime:

```ts
// message: string
for await (const message of websocket(url, { dataMode: 'text' })) { ... }

// message: Uint8Array
for await (const message of websocket(url, { dataMode: 'binary' })) { ... }
```

If the server sends a frame of the wrong type under `'text'` or `'binary'`,
the stream ends with a `DataModeError` (non-retryable — a protocol mismatch
will recur) rather than silently coercing the data.

## Lifecycle: one idiom to stop

There is deliberately **no `close()`** anywhere in this package. A stream
ends in exactly one of these ways:

- `break` (or `return`/`throw`) out of the `for await` loop,
- aborting a `signal` passed in `options`,
- or, for `WebSocketClient`, `await using` the instance (`[Symbol.asyncDispose]`).

```ts
const controller = new AbortController()
const gen = websocket(url, { signal: controller.signal })

// later, from elsewhere:
controller.abort()
```

A non-reconnectable **clean** close (e.g. the server sends close code 1000
and the reconnect policy declines to retry) ends the stream normally — the
`for await` loop just finishes, same as `break`. Any other unclean end
(a network failure, a fatal protocol close, an aborted signal) rejects the
iterator, so wrap the loop in `try`/`catch` if you need to distinguish
"the peer said goodbye" from "something went wrong."

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

By default, a dropped connection is retried with exponential backoff
(jittered, capped by `maxReconnectSeconds`, default `64`) and the backoff
resets to its base after each connection that successfully opens.

- `url` may be a function: `() => string | URL | Promise<string | URL>`. It
  is re-invoked on every attempt, including reconnects — this is the idiom
  for resuming a stream at a cursor (see the firehose example below).
- `shouldReconnect` controls whether a given failure is retried:
  - `true` (default) — the built-in policy: each typed error in the error
    taxonomy self-classifies, and close codes are classified per RFC 6455.
  - `false` — never reconnect; the first end is terminal.
  - `(error, attempt) => boolean` — fully replaces the default classification.

```ts
websocket(url, {
  shouldReconnect: (error, attempt) => attempt < 5,
})
```

Hooks observe the lifecycle: `onOpen(sender)` fires once, for the first
successful connection; `onReconnect(sender)` fires for every connection after
that; `onDisconnect()` fires when the current connection ends (the reliable
point at which to stop using a `sender`); `onError(error, reconnect?)` fires
when a connection ends with an error (`reconnect` is present, with the
attempt count, when a retry is coming); and `onClose(detail)` fires exactly
once, when the stream ends for good.

## Liveness

Two independent mechanisms detect a dead connection that hasn't told you so:

- **Heartbeat** (Node.js only): `heartbeat: { intervalMs }` sends a ping each
  interval and expects any inbound frame (not just a pong) as evidence of
  life. A missed round trips into a `HeartbeatTimeoutError` and a reconnect.
  The browser's WebSocket API has no ping/pong, so this option is ignored
  there.
- **Idle timeout** (both platforms): `idleTimeoutMs` ends the connection with
  an `IdleTimeoutError` if no message arrives within the window. This is the
  browser's only dead-connection detector — set it there if you need one.

## Flow control

- **Node.js**: real socket backpressure. Past `highWaterMark` (default 1 MiB
  of buffered, unread bytes) the underlying socket is paused until the
  consumer catches up.
- **Both platforms**: `maxBufferedBytes` is a hard cap. Exceeding it fails the
  connection with a `BufferOverflowError` (non-retryable) rather than growing
  the buffer without bound. This is the _only_ backstop in the browser, since
  the WHATWG WebSocket API gives no way to pause a socket.

## Compression

`permessage-deflate` is offered by default on both platforms. There is no
option to configure or disable it.

## Sending

`websocket()` itself has no send capability — the hooks hand you a `sender`
whose `send()` you can call while that connection is live. `send()` resolves
on **hand-off** (flush on Node, hand-off to the browser's WebSocket), not on
delivery — at-most-once, the same guarantee a bare WebSocket gives you.

`WebSocketClient` adds a bounded queue (`sendQueueLimit`, default `64`) so
you can call `send()` at any time, including before the first connection
opens or during a reconnect gap:

```ts
import { WebSocketClient } from '@atproto/ws-client'

const client = new WebSocketClient('wss://example.com/feed')

await client.send('hello') // queued if not yet connected, flushed on open

for await (const message of client) {
  console.log(message)
}
```

The queue flushes at-most-once: if a queued send fails to flush, that
promise rejects and is not retried. **At-least-once delivery is a
consumer-side concern** — catch the rejection and call `send()` again to
re-queue for the next connection:

```ts
async function sendReliably(client: WebSocketClient, data: string) {
  for (;;) {
    try {
      return await client.send(data)
    } catch {
      // retry on the next connection
    }
  }
}
```

`@atproto/tap`'s ack path uses exactly this idiom to guarantee an ack is
eventually delivered even across reconnects.

## Headers (Node.js only)

```ts
websocket(url, { headers: { Authorization: `Bearer ${token}` } })
```

`headers` applies to the connection's upgrade request. It's Node.js-only:
the WHATWG WebSocket API used in the browser has no way to set request
headers, so passing `headers` there **throws at construction** rather than
silently dropping what is usually an auth credential. `BrowserWebSocketOptions`
and `BrowserWebSocketClientOptions` omit the field entirely, so this is also
a compile-time error if you import the browser-specific option types.

## Errors

Every connection-level failure is an instance of `WebSocketConnectionError`,
which each subclass classifies via its own `shouldRetry()` — this is what
the default reconnect policy consults:

| Error                   | Meaning                                                    | Retryable by default                |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `CloseError`            | The connection closed with a given code/reason/cleanliness | Classified by close code (RFC 6455) |
| `SocketError`           | A transport-level failure (e.g. connection refused)        | Yes                                 |
| `HeartbeatTimeoutError` | No frame observed within the heartbeat window (Node.js)    | Yes                                 |
| `IdleTimeoutError`      | No message arrived within `idleTimeoutMs`                  | Yes                                 |
| `BufferOverflowError`   | Buffered bytes exceeded `maxBufferedBytes`                 | No                                  |
| `DataModeError`         | A frame's type didn't match `dataMode`                     | No                                  |

`WebSocketClientError` is separate from this taxonomy: it's thrown for
`WebSocketClient` misuse (e.g. calling `send()` after the stream has ended,
or iterating the same client twice), not for anything the connection itself
did.

## Examples

### Resuming a firehose from a cursor

A function-valued `url` is re-invoked on every connection attempt, including
reconnects — read the latest cursor at call time so a reconnect resumes
where the last connection left off instead of restarting the stream:

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

The browser has no heartbeat mechanism, so `idleTimeoutMs` is its only way
to detect a connection that's silently gone dead:

```ts
import { WebSocketClient } from '@atproto/ws-client'

const client = new WebSocketClient('wss://example.com/feed', {
  idleTimeoutMs: 30_000,
})

try {
  for await (const message of client) {
    render(message)
  }
} catch (err) {
  showDisconnected(err)
}
```

## A note for library authors: keep this package external

This package selects its transport (Node vs. browser) via a conditional
package `imports` entry (`#transport`), resolved at import time by the
runtime. If you bundle a library that depends on `@atproto/ws-client` and
pre-bundle this package into your output, that resolution collapses to
whichever transport your bundler's target happened to pick — the result
will not adapt to the environment it actually runs in. Mark
`@atproto/ws-client` as external in your bundler config so each consumer's
own runtime resolves the transport correctly.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
