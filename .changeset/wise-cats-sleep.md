---
'@atproto-labs/simple-store': minor
---

Add `swallowStoreErrors`, a `SimpleStore` decorator that catches errors thrown by the underlying store and forwards them to an error handler (defaulting to `logStoreError`, which logs to the console) instead of propagating them. Use it when the store acts as a cache in front of a source of truth, so that a transient store failure degrades to a cache miss + refetch rather than breaking the operation. Also exports `StoreErrorHandler` and `logStoreError`.
