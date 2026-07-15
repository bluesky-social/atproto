---
'@atproto/ws-client': minor
---

**BREAKING:** `WebSocketConnection` and `WebSocketClient` are now lazy-lifecycle
resources: constructing one opens no socket (`readyState: 'initialized'`), the
socket opens when iteration begins, and `close()` / an aborted `signal` /
breaking the loop stops it. The `opened`/`closed` promises and the
`onOpen`/`onError` constructor callbacks are removed in favor of a typed
`EventTarget` surface: listen for `'open'`, `'error'`, `'close'` (and
`'reconnect'` on `WebSocketClient`) via `addEventListener`. Register
listeners before iterating to observe the first `'open'`.
