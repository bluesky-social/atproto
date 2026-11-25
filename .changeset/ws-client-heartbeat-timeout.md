---
'@atproto/ws-client': patch
---

Add `heartbeat.timeoutMs`, a deadline for a sign of life after each ping. It defaults to, and is capped at, the ping interval.
