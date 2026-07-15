---
'@atproto/ws-client': minor
---

Add `WebSocketConnection`, an isomorphic single-connection WebSocket client consumed as an `AsyncIterable`, with Node (`ws`) and browser (native `WebSocket`) transport adapters behind conditional exports. Runtime differences are reported via `capabilities`. `WebSocketKeepAlive` is unchanged on Node.
