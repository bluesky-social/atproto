---
'@atproto/pds': patch
---

Errors thrown by the scope-reference cache (redis or in-memory) are now logged via the OAuth logger (previously they were silently ignored on read) while continuing to degrade to a cache miss and a refetch from entryway rather than breaking token verification.
