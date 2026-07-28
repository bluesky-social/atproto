---
'@atproto/sync': minor
---

**BREAKING:** `FirehoseOptions` no longer accepts arbitrary `ws` `ClientOptions`. The supported connection options are now explicit: `headers` (`HeadersInit`), `maxReconnectSeconds`, and `heartbeatIntervalMs`.
