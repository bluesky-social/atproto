---
'@atproto/tap': minor
---

**BREAKING:** `TapWebsocketOptions` no longer accepts arbitrary `ws` `ClientOptions` — its options are now an explicit set (`adminPassword`, `maxReconnectSeconds`, `heartbeatIntervalMs`, `onReconnectError`, plus a new `headers` field accepting `HeadersInit`). `TapChannel` now rides on `@atproto/ws-client`'s `WebSocketClient`; `ackEvent()` retries until the ack is actually sent, resolving only once a send flushes successfully rather than resolving once on a single attempt. Reconnect classification is unchanged in spirit (reconnects only on abnormal closes and transport/liveness failures), but is no longer filtered by errno code, and `onReconnectError`'s `initialSetup` argument is now true for the first attempt of each reconnect cycle rather than only before the first-ever successful connection.
