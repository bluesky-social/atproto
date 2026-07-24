---
'@atproto-labs/handle-resolver': patch
---

Errors thrown by the handle cache are now caught and logged instead of being propagated, degrading to a cache miss and resolution from the underlying resolver. A new `onHandleCacheError` option (on `CachedHandleResolver` and `createHandleResolver`) allows overriding how these errors are handled (e.g. to route them to an application logger).
