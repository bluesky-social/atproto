# Actor Store Schema Migrations

Each "actor" (i.e. user) has its own store, an SQLite db. It stores repo data (records, etc.) and other per-user state.

Individual migrations are managed by Kysely, and pending migrations happen automatically when a store is opened (so PDS code will always see the latest schema version, after opening a store).

Actor store schema versions are also tracked centrally in the Account db, enabling the `internal.pds.getActorStoreMigrationStatus` admin endpoint to report migration progress.

To make sure rarely-opened stores get migrated in a timely manner, and to ensure that the versions tracked in the Account db are consistent with the true actor store schema versions (they could hypothetically get out of sync after a crash), the `ActorStoreMigrator` task iterates over all un-migrated actor stores, migrates them, and tracks progress in the Account db.

By default `ActorStoreMigrator` runs on PDS startup, blocking until all dbs are migrated, which keeps things simple for smaller-scale PDS deployments.

If `PDS_ACTOR_STORE_MIGRATE_IN_BACKGROUND` is set, it instead runs in the background.

## Schema Compatibility

Bluesky prod PDS deployments run multiple containers sharing the same on-disk actor stores, upgraded one at a time during a rolling deploy. This means an "old" container can open an actor store that a "new" container has already migrated to a schema version the old container has never heard of.

Migrations must be written with this in mind, and ideally new schemas should never break queries from earlier versions.

If breaking backwards compatibility is unavoidable, explicit schema version checks should be used, and those checks should be deployed prior to the migration itself.

## Env Vars

`PDS_ACTOR_STORE_MIGRATE_IN_BACKGROUND` (bool, default false)

`PDS_ACTOR_STORE_MAX_CONCURRENT_MIGRATIONS` (int, default 1000)
