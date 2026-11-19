import {
  type DialectAdapter,
  type Kysely,
  type MigrationLockOptions,
  SqliteAdapter,
  SqliteDialect,
  sql,
} from 'kysely'

/**
 * Kysely's sqlite dialect, with migrations that are atomic and serialized
 * across connections and processes.
 */
export class LockingSqliteDialect extends SqliteDialect {
  override createAdapter(): DialectAdapter {
    return new LockingSqliteAdapter()
  }
}

/**
 * Runs all pending migrations in one transaction, so they either all succeed
 * or all roll back. Kysely's default sqlite adapter doesn't use a transaction.
 */
export class LockingSqliteAdapter extends SqliteAdapter {
  override get supportsTransactionalDdl(): boolean {
    return true
  }

  override async acquireMigrationLock(
    db: Kysely<any>,
    { lockTable, lockRowId }: MigrationLockOptions,
  ): Promise<void> {
    // @NOTE sqlite allows only one write transaction at a time. This first
    // write takes its write lock before Kysely reads the migration history;
    // competing writers get SQLITE_BUSY and must retry the transaction.
    await sql`update ${sql.table(lockTable)} set is_locked = 1 where id = ${lockRowId}`.execute(
      db,
    )
  }

  override async releaseMigrationLock(
    db: Kysely<any>,
    { lockTable, lockRowId }: MigrationLockOptions,
  ): Promise<void> {
    // @NOTE resetting the flag keeps the row unchanged between runs. The
    // write lock remains held until Kysely commits or rolls back the transaction.
    await sql`update ${sql.table(lockTable)} set is_locked = 0 where id = ${lockRowId}`.execute(
      db,
    )
  }
}
