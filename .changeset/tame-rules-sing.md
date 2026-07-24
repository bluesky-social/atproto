---
'@atproto/pds': patch
---

Errors thrown by the scope-reference cache (redis or in-memory) are now caught and logged via the OAuth logger instead of being propagated, degrading to a cache miss and a refetch from entryway rather than breaking token verification.
