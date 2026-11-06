---
'@atproto/pds': patch
---

Unify how the server checks it holds the current PLC rotation key before relying on it, using one shared check and error message across `signPlcOperation`, `updateHandle`, `activateAccount`/`checkAccountStatus`, and `submitPlcOperation`, instead of several slightly different ad-hoc checks.
