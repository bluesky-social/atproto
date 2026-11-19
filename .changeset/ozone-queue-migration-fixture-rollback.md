---
'@atproto/ozone': patch
---

Build the strict-queue migration test fixture in a rolled-back transaction, so it no longer drops a schema in the shared test database while other packages run migrations.
