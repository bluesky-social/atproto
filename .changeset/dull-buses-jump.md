---
'@atproto/oauth-provider': patch
---

Errors thrown by the client (JWKS & metadata) and lexicon caches are now logged (previously they were silently ignored on read) while continuing to degrade to a cache miss and a refetch/re-resolution rather than breaking the operation.
