---
'@atproto/oauth-client': patch
---

The `SessionGetter` now propagates the `AbortSignal` when fetching the Authorization Server metadata, allowing it to abort the request earlier.
