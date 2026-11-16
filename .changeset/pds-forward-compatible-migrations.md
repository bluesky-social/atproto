---
'@atproto/pds': patch
---

Boot against databases already migrated by a newer PDS version, so releases can be rolled back. Run SQLite migrations in a single locked transaction, so concurrent or interrupted migrations can't leave a database half-migrated.
