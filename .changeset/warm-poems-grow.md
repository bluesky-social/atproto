---
'@atproto/oauth-client': patch
---

Errors thrown by the metadata caches (authorization server & protected resource) are now caught and logged instead of being propagated, degrading to a cache miss and a refetch. A new `onCacheError` config option on both metadata resolvers allows overriding how these errors are handled.
