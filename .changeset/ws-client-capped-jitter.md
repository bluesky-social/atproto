---
'@atproto/ws-client': patch
'@atproto/sync': patch
---

Jitter the reconnect backoff by ±50% around its exponential base (`2^attempt` seconds), after capping that base at `maxReconnectSeconds`, rather than by ±0.5s and then capping the delay. Clients dropped together now keep spreading out once capped, instead of all retrying every `maxReconnectSeconds`. A capped delay is now between 0.5 and 1.5 times `maxReconnectSeconds`.
