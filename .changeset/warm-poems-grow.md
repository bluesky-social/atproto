---
'@atproto/oauth-client': patch
---

Errors thrown by the metadata caches (authorization server & protected resource) are now logged (previously they were silently ignored on read) while continuing to degrade to a cache miss and a refetch. A new `onCacheError` config option on both metadata resolvers allows overriding how these errors are handled.
