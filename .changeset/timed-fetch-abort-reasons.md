---
'@atproto-labs/fetch': patch
---

`timedFetch` now rejects with the abort reason of the request's signal, rejects with a `TimeoutError` when its own timeout elapses, and no longer sends a request whose signal is already aborted.
