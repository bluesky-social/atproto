---
'@atproto/ws-client': minor
'@atproto/xrpc-server': minor
---

**BREAKING:** Replace `WebSocketKeepAlive` with `WebSocketClient`, an isomorphic reconnection layer built on `WebSocketConnection` that works identically in Node and the browser. Reconnect decisions now use `WebSocketConnection`'s typed error taxonomy and RFC-6455 close codes instead of errno string-matching, and a durable stream now survives graceful server restarts (close `1001`). `WebSocketKeepAlive` is removed; migrate to `new WebSocketClient(url, options)`. Reconnection is controlled via `options.shouldReconnect: boolean | ((error, attempt) => boolean)` (default `true` for the built-in policy, `false` to disable reconnecting entirely, or a function for custom classification), and `WebSocketClient` throws its own `WebSocketClientError` for misuse (e.g. `send()` before connected) distinct from the `WebSocketConnectionError` taxonomy. `CloseCode` is expanded to cover the full RFC 6455 close-code registry; `DisconnectError` moves to `@atproto/xrpc-server` (its only consumer). Node-only per-connection `headers` are supported (ignored in the browser build).
