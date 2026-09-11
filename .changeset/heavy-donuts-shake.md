---
'@atproto/pds': patch
---

`registerPush`, `unregisterPush` and `createReport` now issue their outbound
call through the PDS's default `safeFetch`
