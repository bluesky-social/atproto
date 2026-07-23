---
'@atproto/ws-client': minor
---

**BREAKING:** Overhaul the package around two new isomorphic classes, replacing `WebSocketKeepAlive`. `WebSocketClient` is a robust WebSocket client that prioritizes liveness, flow control, and transparent reconnects — reads are an `AsyncIterable` spanning reconnects, and lifecycle is observable via `onOpen`/`onReconnect`/`onError`/`onClose` hook options. `WebSocketConnection` is the underlying single-connection primitive. Both work identically in Node.js and the browser, using whatever capabilities each platform offers. Reconnect decisions are based on a typed error taxonomy and WebSocket close codes, controllable via `shouldReconnect`. `DisconnectError` moves to `@atproto/xrpc-server`.
