---
'@atproto/xrpc-server': minor
---

**BREAKING:** `Subscription` no longer accepts arbitrary `ws` `ClientOptions` — its options are now an explicit set (`service`, `method`, `validate`, `getParams`, `signal`, `maxReconnectSeconds`, `heartbeatIntervalMs`, `onReconnectError`, plus a new `headers` field for request headers). Reconnection behavior also changes with the move to `@atproto/ws-client`'s `websocket()`: a subscription now reconnects after graceful server restarts (close code 1001) and other transient close codes where it previously gave up, and `onReconnectError`'s `initialSetup` argument now means "the first attempt of this reconnect cycle" rather than "before the first-ever successful connection". `DisconnectError` is now defined and exported by this package (previously re-exported from `@atproto/ws-client`).
