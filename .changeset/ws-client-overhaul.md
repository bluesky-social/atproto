---
'@atproto/ws-client': minor
---

**BREAKING:** Replace `WebSocketKeepAlive` with `websocket(url, options?)`, an async iterable that connects, reads messages, reconnects on failure, and yields one continuous stream. It works on Node.js and in the browser with the same API.

There is no `close()`. A stream ends by breaking out of the loop or aborting a `signal`, and how you stop decides how the socket ends: `break` or a bare `abort()` closes with `1000`, `abort(new CloseError(…))` closes with that error's code, and any other abort reason destroys the connection (`1006`).

Lifecycle hooks come at two levels: `onOpen()`/`onClose(detail)` fire once per stream, while `onConnect(sender)`/`onDisconnect()` fire per connection. Sending goes through the `sender` handed to `onConnect`; there is no send queue.

Reconnect decisions are driven by close codes and typed errors that extend `WebSocketClientError`, controllable via `shouldReconnect`. On Node.js a heartbeat is on by default at a 10s interval (`heartbeat: false` disables it); `idleTimeoutMs` is off by default and is the browser's only dead-connection detector.

`DisconnectError` moves to `@atproto/xrpc-server`, and `@atproto/common` is no longer a dependency.
