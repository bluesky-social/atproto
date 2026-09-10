---
'@atproto/pds': patch
---

`registerPush`, `unregisterPush` and `createReport` now issue their outbound
call through the PDS's SSRF-protected fetch, so a service endpoint resolved from
a DID document must be an https origin resolving to a unicast address, and its
response is size-capped. Unchanged when `disableSsrfProtection` is set.
