---
'@atproto/ozone': patch
---

Stop the reporterDid backfill test from dropping and re-adding the column, which raced with other packages' tests on the shared test database.
