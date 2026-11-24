---
'@atproto/pds': patch
---

Migrate stored space URIs from `at://{spaceDid}/space/...` to `at:space/{spaceDid}/...`, in a new actor-store migration and a new account-manager migration. Record values are left as they are. Space params must use the new form.
