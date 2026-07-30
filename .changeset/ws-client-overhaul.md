---
'@atproto/ws-client': minor
---

**BREAKING:** Replace `WebSocketKeepAlive` with `websocket()`, an isomorphic async generator returning a `WebSocketIterable<M>`. Reading is a single `AsyncIterable` that spans reconnects, and there is no `close()`: a stream ends by `break`/`throw`/`return` on the iteration or by aborting a `signal`.

How you stop decides how the socket ends, which is also how you ask for a specific close code — a bare `abort()` or a loop `break` closes with `1000`, `abort(new CloseError(code, …))` closes with that code, and any other abort reason destroys the connection (`1006`).

Lifecycle hooks come at two levels: `onOpen()`/`onClose(detail)` bookend the stream once each, while `onConnect(sender)`/`onDisconnect()` bookend each connection and pair exactly — a dial that never connected produces neither, so a stream stuck retrying reports one `onDisconnect` and an `onError` per failed attempt. `onClose` fires only once the local socket has closed. Sending goes through the `sender` handed to `onConnect`. There is deliberately no send queue: a queued send could only be flushed by a later connection, so awaiting one from inside the loop would block the pull that delivery depends on.

Reconnect decisions are driven by a typed error taxonomy (`CloseError`, `SocketError`, `HeartbeatTimeoutError`, `IdleTimeoutError`, `BufferOverflowError`, `DataModeError`, all extending `WebSocketClientError` and each self-classifying via `shouldRetry()`) and WebSocket close codes, controllable via `shouldReconnect`. A protocol heartbeat is on by default on Node at a 10s interval (`heartbeat: false` to disable); `idleTimeoutMs` is off by default and is the browser's only dead-connection detector. `DisconnectError` moves to `@atproto/xrpc-server`. `CloseCode` now covers the full RFC 6455 close code list. `@atproto/common` is no longer a dependency.
