---
'@atproto/tap': minor
---

**BREAKING:** `TapWebsocketOptions` no longer accepts arbitrary `ws` `ClientOptions` — its options are now an explicit set (`adminPassword`, `maxReconnectSeconds`, `heartbeatIntervalMs`, `onReconnectError`, plus a new `headers` field accepting `HeadersInit`).

`ackEvent()` now resolves once the ack has been sent or recorded for the next connection, rather than once it is confirmed delivered. It cannot promise more than that: a handler runs inside the channel's own iteration, and a reconnect only happens when that iteration advances, so awaiting confirmed delivery from a handler blocked the very reconnect it was waiting for. (That deadlock predates this change — it reproduces against the previous client, where it also defeated `destroy()`.) Acks issued while no connection is live are flushed when the next one comes up, and Tap's at-least-once redelivery covers an ack lost with its connection.

Reconnect classification is unchanged in spirit (reconnects only on abnormal closes and transport/liveness failures), but is no longer filtered by errno code, and `onReconnectError`'s `initialSetup` argument is now true for the first attempt of each reconnect cycle rather than only before the first-ever successful connection.
