---
"@atproto/pds": patch
---

Look up accounts by handle and by email through the existing `lower(handle)` and `lower(email)` indexes. `getAccount` by handle (behind `createSession` and `resolveHandle`), `getAccountByEmail` and `updateHandle`'s check that a handle is free compared the bare column, which those indexes can't serve, so each scanned the whole `actor` or `account` table.
