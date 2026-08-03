---
'@atproto/ws-client': minor
---

**BREAKING:** Replace `WebSocketKeepAlive` with `websocket(url, options?)`, an async iterable that connects, reads messages, reconnects on failure, and yields one continuous stream. It works on Node.js and in the browser with the same API.

There is no `close()`. A stream ends by breaking out of the loop or aborting a `signal`. Stopping always closes the socket politely, and the abort reason picks the code: `abort(new CloseError(…))` closes with that error's code, anything else closes with `1000`. The reason still reaches the consumer as the iterator's rejection.

Lifecycle hooks come at two levels: `onOpen()`/`onClose(detail)` fire once per stream, while `onConnect(sender)`/`onDisconnect()` fire per connection. Failures are split between `onReconnect(error, { attempt })`, the only place a retried failure surfaces, and `onError(error)`, which fires when the stream gives up and reports the same error the iterator rejects with. Sending goes through the `sender` handed to `onConnect`; there is no send queue.

Iteration settles only once the underlying socket has closed, so the end of a `for await` means teardown is finished. On Node.js the close handshake is capped at one second, rather than the 30 seconds `ws` waits by default, so a shutdown can't stall on an unresponsive peer.

Reconnect decisions are driven by close codes and typed errors that extend `WebSocketClientError`, controllable via `shouldReconnect`. On Node.js a heartbeat is on by default at a 10s interval (`heartbeat: false` disables it); `idleTimeoutMs` is off by default and is the browser's only dead-connection detector.

`DisconnectError` moves to `@atproto/xrpc-server`, and `@atproto/common` is no longer a dependency.
