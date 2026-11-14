---
'@atproto-labs/did-resolver': minor
---

**Breaking**: The `cache` argument of the `DidResolverCached` constructor is required. `createDidResolver()` still defaults to an in-memory `DidCacheMemory`.
