---
'@atproto/tap': minor
---

**BREAKING:** `TapWebsocketOptions` now takes an explicit set of options rather than arbitrary `ws` `ClientOptions`, and adds a `headers` option for the upgrade request.

`ackEvent()` now resolves once the ack has been sent — or recorded for the next connection — rather than once it is confirmed delivered. Awaiting confirmed delivery from a handler could deadlock the channel (a bug that predates this change). Acks issued while disconnected are flushed when the next connection comes up, and Tap's at-least-once redelivery covers an ack lost with its connection.

`onReconnectError`'s `initialSetup` argument now means "first attempt of this reconnect cycle" rather than "before the first-ever successful connection".
