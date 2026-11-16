import {
  type DialectAdapter,
  type Kysely,
  type MigrationLockOptions,
  SqliteAdapter,
  SqliteDialect,
  sql,
} from 'kysely'

/**
 * Kysely's SQLite dialect, with migrations that are atomic and serialized
 * across connections and processes.
 */
export class LockingSqliteDialect extends SqliteDialect {
  override createAdapter(): DialectAdapter {
    return new LockingSqliteAdapter()
  }
}

/**
 * Kysely's stock SQLite adapter runs migrations statement by statement with no
 * lock, so two connections can both apply a migration, and a crash midway
 * leaves a database that no later run can migrate.
 *
 * SQLite DDL is transactional, so this adapter has kysely run the lock, its
 * read of migration state, and every pending migration in one transaction.
 * The lock is a write to kysely's own lock row. As the transaction's first
 * statement, it takes SQLite's write lock before kysely reads which migrations
 * have run, like `BEGIN IMMEDIATE`. A connection that loses the race gets
 * `SQLITE_BUSY` and should retry, after which it finds nothing pending.
 * Commit or rollback releases the lock.
 */
export class LockingSqliteAdapter extends SqliteAdapter {
  override get supportsTransactionalDdl(): boolean {
    return true
  }

  override async acquireMigrationLock(
    db: Kysely<any>,
    { lockTable, lockRowId }: MigrationLockOptions,
  ): Promise<void> {
    await sql`update ${sql.table(lockTable)} set is_locked = 1 where id = ${lockRowId}`.execute(
      db,
    )
  }

  override async releaseMigrationLock(): Promise<void> {}
}
