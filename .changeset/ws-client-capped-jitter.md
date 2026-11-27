---
'@atproto/ws-client': patch
---

Jitter the reconnect backoff proportionally (each delay is drawn between 50% and 100% of its exponential base) and after capping it at `maxReconnectSeconds`, so that clients dropped together keep spreading out once capped instead of all retrying every `maxReconnectSeconds`.
