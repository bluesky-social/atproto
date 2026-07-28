---
'@atproto/ws-client': minor
---

**BREAKING:** Replace `WebSocketKeepAlive` with `websocket()`, an isomorphic async generator, and `WebSocketClient`, a thin class adding a bounded send queue. Reading is a single `AsyncIterable` that spans reconnects; termination is one idiom — `break`/`throw`/`return` on the iteration, an aborted `signal`, or `[Symbol.asyncDispose]` on the class — there is no `close()`. Reconnect decisions are driven by a typed error taxonomy (`CloseError`, `SocketError`, `HeartbeatTimeoutError`, `IdleTimeoutError`, `BufferOverflowError`, `DataModeError`, each self-classifying via `shouldRetry()`) and WebSocket close codes, controllable via `shouldReconnect`. `DisconnectError` moves to `@atproto/xrpc-server`. `CloseCode` now covers the full RFC 6455 close code list. `@atproto/common` is no longer a dependency.
