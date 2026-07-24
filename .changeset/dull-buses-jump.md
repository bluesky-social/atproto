---
'@atproto/oauth-provider': patch
---

Errors thrown by the client (JWKS & metadata) and lexicon caches are now caught and logged instead of being propagated, degrading to a cache miss and a refetch/re-resolution rather than breaking the operation.
