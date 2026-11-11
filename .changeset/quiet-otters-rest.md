---
'@atproto/ozone': patch
---

Remove the reporterDid migration test, which raced with other packages' tests on the shared test database.
