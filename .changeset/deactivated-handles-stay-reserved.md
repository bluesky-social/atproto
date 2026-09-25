---
'@atproto/pds': patch
---

Report a handle or email belonging to a deactivated or taken down account as an `InvalidRequest` from `com.atproto.server.createAccount`, instead of failing with an `InternalServerError` once the insert hits the unique index.
