---
'@atproto/sync': minor
---

**BREAKING:** `FirehoseOptions` now takes an explicit set of connection options (`headers`, `maxReconnectSeconds`, `heartbeatIntervalMs`) rather than arbitrary `ws` `ClientOptions`.
