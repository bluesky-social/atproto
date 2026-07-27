---
'@atproto-labs/simple-store': minor
---

**BREAKING:** Remove `onStoreError` from the `CachedGetterOptions`. The same behavior can be reproduced by either overriding the `setStored` method, or by handling errors in the `SimpleStore.set` method.
