# packages/pds

## SQLite migrations are additive only

Every PDS SQLite database (account, sequencer, did-cache, actor stores) may be
opened by an _older_ PDS after a newer one migrated it: releases are rolled
back by re-tagging an older image, and `Migrator` (`src/db/migrator.ts`) lets
older code boot past migrations it doesn't know. So a migration may only add:
new tables, nullable or defaulted columns, new indexes. Never drop, rename, or
change the type of anything a previous release reads.

## Migrations run in one transaction

`LockingSqliteDialect` (`src/db/sqlite-dialect.ts`) has kysely apply all pending
migrations in a single transaction that holds SQLite's write lock, so racing
connections and interrupted runs can't leave a database half-migrated. A
migration therefore must not use statements SQLite refuses inside a
transaction, such as `PRAGMA journal_mode` or `VACUUM`.
