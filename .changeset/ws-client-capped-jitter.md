---
'@atproto/ws-client': patch
---

Use "full jitter" for the reconnect backoff: each delay is now drawn at random below its exponential base (`2^attempt` seconds), capped at `maxReconnectSeconds`, rather than within ±0.5s of that base and then capped. Clients dropped together now keep spreading out once capped, instead of all retrying every `maxReconnectSeconds`, and spread over the whole first second when they reconnect after a server shuts down.
