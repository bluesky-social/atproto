---
'@atproto/ws-client': minor
---

Add `WebSocketConnection`: a single WebSocket connection, consumed as an `AsyncIterable` of messages, with the same API in Node.js (via `ws`) and the browser (via the native `WebSocket`) through conditional package exports. Constructing one opens nothing; the socket opens when iteration begins, and `close()` / an aborted `signal` / breaking the loop stops it. Lifecycle is observable via a typed `EventTarget` surface (`'open'`, `'error'`, `'close'`). Messages are typed and enforced by `dataMode` (`'auto' | 'text' | 'binary'`). Includes liveness checks (protocol heartbeat on Node.js, message-based `idleTimeoutMs` everywhere), read-side flow control (`highWaterMark` backpressure on Node.js, `maxBufferedBytes` hard cap everywhere), Node.js-only request `headers`, and a typed error taxonomy rooted at `WebSocketConnectionError`. Platform differences are reported as data via `capabilities`.
