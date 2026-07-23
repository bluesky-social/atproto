---
'@atproto/tap': minor
---

**BREAKING:** `TapWebsocketOptions` no longer accepts arbitrary `ws` `ClientOptions` — its options are now an explicit set (`adminPassword`, `maxReconnectSeconds`, `heartbeatIntervalMs`, `onReconnectError`, plus a new `headers` field accepting `HeadersInit`). `TapChannel` now rides on `@atproto/ws-client`'s `WebSocketClient`; its reconnect classification is unchanged (reconnects only on abnormal closes and transport failures), but transport errors are no longer filtered by errno code, and `onReconnectError`'s `initialSetup` argument is now true for the first attempt of each reconnect cycle rather than only before the first-ever successful connection.
