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

The package exports one thing: **`websocket(url, options?)`**, an async
generator. Connect, read messages, reconnect on failure, and yield a single
continuous stream to the consumer regardless of how many times the underlying
socket was replaced. Its return type is `WebSocketIterable<M>`.

Everything else (error classes, `CloseCode`, option types) supports that
entrypoint.

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

There is deliberately **no `close()`** anywhere in this package. A stream ends
in exactly one of two ways: you `break` (or `return`/`throw`) out of the
`for await` loop, or you abort a `signal` passed in `options`.

```ts
const controller = new AbortController()
const gen = websocket(url, { signal: controller.signal })

// later, from elsewhere:
controller.abort()
```

**How you stop decides how the socket ends**, which is also how you ask for a
specific close code — there is no separate option for it:

| how you stop                          | what the peer sees            |
| ------------------------------------- | ----------------------------- |
| `break`/`throw` in the loop           | close `1000`                  |
| `controller.abort()` (no argument)    | close `1000`                  |
| `controller.abort(new CloseError(…))` | close with that error's code  |
| `controller.abort(anythingElse)`      | `1006` — connection destroyed |

The last row is the fast path: a reason that isn't a request to stop is treated
as a failure, and the connection is destroyed rather than closed politely.
`break` and `throw` are indistinguishable to a generator (both produce a return
completion), so they share the plain clean close.

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

Hooks observe the lifecycle at two levels. `onOpen()` and `onClose(detail)`
bookend the **stream**, once each; `onConnect(sender)` and `onDisconnect()`
bookend each **connection**, as many times as it takes.

| hook                         | when                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `onOpen()`                   | the stream is live, once, just before the first `onConnect`  |
| `onConnect(sender)`          | a connection is up — including the first                     |
| `onDisconnect()`             | that connection ended                                        |
| `onError(error, reconnect?)` | a connection ended badly; `reconnect` present ⟹ retry coming |
| `onClose(detail)`            | the stream ended, once, after the local socket has closed    |

`onConnect` and `onDisconnect` pair exactly: a dial that never connected
produces neither. So a stream stuck retrying reports one `onDisconnect` for the
connection it lost and an `onError` per failed attempt — not a disconnect per
attempt.

`onDisconnect`, not `onError`, is the reliable point at which to stop using a
`sender`: the loop only advances when the consumer pulls, so `onError` can
arrive well after the socket died.

`onClose` fires only once the local socket is closed, so it is safe to treat as
"teardown is done" and release whatever the stream depended on. `wasClean: true`
means the close was orderly on our end — not that the peer acknowledged, which
no client can wait on without risking an indefinite hang.

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

Both are on by default only in the Node case: `heartbeat` defaults to a 10s
interval (pass `heartbeat: false` to disable, or `{ intervalMs }` to change it),
while `idleTimeoutMs` is off unless you set it.

**A connection that fails discards whatever it had buffered but undelivered** —
a liveness timeout, a byte-cap overflow, or a transport error drops those
messages rather than yielding data from a connection already known to be broken.
A _clean_ close still drains what arrived before it. For cursor-based streams
this is harmless, since a reconnect resumes from the cursor; if your stream isn't
resumable, keep `highWaterMark` low enough that little is ever in flight.

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

`websocket()` yields messages; sending is done with the `sender` handed to
`onConnect`. A sender belongs to one connection and rejects once that connection
ends, so always use the most recent one rather than retaining an older:

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
  if (message === 'ping') await sender?.send('pong')
}
```

`send()` resolves on **hand-off** (flushed on Node, accepted by the browser's
WebSocket), not on delivery — at-most-once, the same guarantee a bare WebSocket
gives you. A message handed to a socket that then dies is simply lost.

There is deliberately no send queue. A queued send could only be flushed by a
later connection, and a reconnect only happens when the consumer pulls — so
awaiting a queued send from inside the `for await` loop would block the very pull
that delivery depends on. Sending through the current connection's sender makes
that deadlock impossible to write by accident.

**If you need at-least-once delivery**, own that above this package: record what
hasn't been acknowledged, and flush it from `onConnect` — which runs off the
socket's own event, so it doesn't depend on the iteration advancing.
`@atproto/tap`'s ack path is exactly this.

## Headers (Node.js only)

```ts
websocket(url, { headers: { Authorization: `Bearer ${token}` } })
```

`headers` applies to the connection's upgrade request. It's Node.js-only:
the WHATWG WebSocket API used in the browser has no way to set request
headers, so passing `headers` there **throws at construction** rather than
silently dropping what is usually an auth credential. `BrowserWebSocketOptions`
omits the field entirely, so this is also a compile-time error if you import the
browser-specific option type.

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

`WebSocketClientError` is separate from this taxonomy: it marks misuse of the
API itself rather than anything the connection did, and is never retryable.

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
