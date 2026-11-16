# packages/pds

## SQLite migrations are additive only

Every PDS SQLite database (account, sequencer, did-cache, actor stores) may be
opened by an _older_ PDS after a newer one migrated it: releases are rolled
back by re-tagging an older image, and `Migrator` (`src/db/migrator.ts`) lets
older code boot past migrations it doesn't know. So a migration may only add:
new tables, nullable or defaulted columns, new indexes. Never drop, rename, or
change the type of anything a previous release reads.
