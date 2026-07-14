---
'@atproto/ws-client': minor
---

**BREAKING:** Replace `WebSocketKeepAlive` with `ReconnectingWebSocket`, an isomorphic reconnection layer built on `WebSocketCore` that works identically in Node and the browser. Reconnect decisions now use `WebSocketCore`'s typed error taxonomy and RFC-6455 close codes instead of errno string-matching, and a durable stream now survives graceful server restarts (close `1001`). `WebSocketKeepAlive` is removed; migrate to `new ReconnectingWebSocket(url, options)`. `CloseCode` and `DisconnectError` are unchanged. Node-only per-connection `headers` are supported (ignored in the browser build).
