---
'@atproto/pds': patch
---

`submitPlcOperation` no longer requires the proposed operation to keep the server's rotation key - consistent with `activateAccount`/`checkAccountStatus`, a self-custodied account can submit an operation that fully transfers rotation control away from the server.
