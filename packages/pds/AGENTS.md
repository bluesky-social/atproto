# packages/pds

## SQLite migrations are additive only

Every PDS SQLite database (account, sequencer, did-cache, actor stores) may be
opened by an _older_ PDS after a rollback. `Migrator` (`src/db/migrator.ts`)
lets older code boot past migrations it doesn't know. So a migration may only add
things a previous release can ignore: new tables, nullable or defaulted
columns, non-unique indexes. Never drop, rename, or change the type of anything
a previous release reads, and never add a unique index, constraint, or trigger
that a previous release's writes could violate. Newer code must also tolerate
rows that older code wrote, or left unmaintained, while it was rolled back.

## Migrations run in one transaction

`LockingSqliteDialect` (`src/db/sqlite-dialect.ts`) has kysely apply all pending
migrations in a single transaction that holds SQLite's write lock, so racing
connections and interrupted runs can't leave a database half-migrated. A
migration therefore must not use statements SQLite refuses inside a
transaction, such as `PRAGMA journal_mode` or `VACUUM`.

## Spaces migration path is temporary

Migrating accounts to spaces readiness (publisher, sweep, progress table use,
the `internal.pds.*` endpoints but `reserveKemKey`, `spacesMigration` health
field) is removed once the fleet completes; only its schema stays, per
additive-only. `reserveKemKey` stays for entryway signups. While it exists:

- A KEM key file is written (no-clobber, fsynced) before it is ever published,
  and a KEM key beside an existing actor store is never overwritten: a DID
  document must never name a KEM key the PDS doesn't hold. (`ActorStore.create`
  may replace an orphaned key from a failed create, which was never published.)
- The PDS publisher never runs behind an entryway; the entryway publishes and
  the PDS only exposes the `internal.pds.*` endpoints.
- Background migration workers must never throw out to the process.
- An account has a progress row or a settled `actor.kemKeyState`, never both.
  A row settles (its outcome moves to `kemKeyState` and it is deleted) in the
  tracked write that makes it final: store migrated, and key published,
  did:web or tombstoned. Only `recordChecked()` (or re-creating the account)
  unsettles one.
- `storeMigratedAt` is recorded only once the store is at the latest schema
  and holds a KEM key; opening a store migrates its schema, not its key.
- Rows come from account creation and the sweep's seed, which inserts only
  where `kemKeyState` is null, rechecked inside the write so a racing settle
  is never undone. Only the sweep migrates stores, so the publisher must never
  run where the sweep doesn't.
- A deactivated account's row is parked (`nextAttemptAt` null) and only
  `AccountManager.activateAccount` unparks it, in the activation's transaction.
- Claims scan one priority at a time so that `nextAttemptAt` bounds the index
  scan; a claim that visits parked or backing-off rows is a regression.
- `PDS_SPACES_MIGRATION=complete` lets code assume every held KEM key is
  published, instead of reading migration progress or PLC. Any such shortcut
  must be safe when set wrongly: it may refuse a request, never corrupt data.
- `spaces_migration_stats` is kept up to date by every write that can change a
  counter: such writes go through `trackStats()`, in the same transaction.
  Only lease columns may be written around it. Drifted stats are reported,
  never enforced, and only corrected by `internal.pds.recountSpacesMigration`.
  Nothing scans the progress table on a schedule: sqlite queries block the
  event loop.
