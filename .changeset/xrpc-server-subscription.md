---
'@atproto/xrpc-server': minor
---

**BREAKING:** `Subscription` no longer accepts arbitrary `ws` `ClientOptions` — its options are now an explicit set (`service`, `method`, `validate`, `getParams`, `signal`, `maxReconnectSeconds`, `heartbeatIntervalMs`, `onReconnectError`, plus a new `headers` field for request headers). Reconnection behavior also changes with the move to `@atproto/ws-client`'s `WebSocketClient`: a subscription now reconnects after graceful server restarts (close `1001`) and other transient close codes where it previously stopped, and `onReconnectError`'s `initialSetup` argument is now true for the first attempt of each reconnect cycle rather than only before the first-ever successful connection. `DisconnectError` is now defined and exported by this package (previously re-exported from `@atproto/ws-client`).
