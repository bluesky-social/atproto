---
'@atproto-labs/did-resolver': patch
---

Errors thrown by the DID cache are now logged (previously they were silently ignored on read) while continuing to degrade to a cache miss and resolution from the underlying resolver. A new `onDidCacheError` option (on `DidResolverCached` and `createDidResolver`) allows overriding how these errors are handled (e.g. to route them to an application logger).
