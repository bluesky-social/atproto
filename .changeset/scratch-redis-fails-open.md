---
"@atproto/xrpc-server": patch
"@atproto/pds": patch
---

Scratch Redis failures fail open. In `@atproto/xrpc-server`, a route's own rate limit now logs a store error and lets the request through, as global and shared limits already did, unless it sets `failClosed`. In `@atproto/pds`, the scratch Redis client fails a command after 500 ms or at once when disconnected instead of queueing it, the DPoP replay check falls back to process memory when Redis fails, and shutdown no longer fails on a Redis that doesn't answer.
