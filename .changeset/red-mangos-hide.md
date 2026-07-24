---
'@atproto-labs/did-resolver': patch
---

Errors thrown by the DID cache are now caught and logged instead of being propagated, degrading to a cache miss and resolution from the underlying resolver. A new `onDidCacheError` option (on `DidResolverCached` and `createDidResolver`) allows overriding how these errors are handled (e.g. to route them to an application logger).
