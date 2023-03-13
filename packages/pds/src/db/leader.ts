import { PoolClient } from 'pg'
import Database from '.'

export class Leader {
  session: Session | null = null
  static inProcessLocks = new Map<number, WeakSet<Database>>() // Only for sqlite in-process locking mechanism

  constructor(public id: number, public db: Database) {}

  async run<T>(
    task: (ctx: { signal: AbortSignal }) => Promise<T>,
  ): Promise<RunResult<T>> {
    const session = await this.lock()
    if (!session) return { ran: false }
    try {
      const result = await task({ signal: session.abortController.signal })
      return { ran: true, result }
    } finally {
      this.release()
    }
  }

  destroy(err?: Error) {
    this.session?.abortController.abort(err)
  }

  private async lock(): Promise<Session | null> {
    if (this.session) {
      return null
    }

    if (this.db.cfg.dialect === 'sqlite') {
      const locksForId = Leader.inProcessLocks.get(this.id) ?? new WeakSet()
      if (locksForId.has(this.db)) {
        return null
      } else {
        Leader.inProcessLocks.set(this.id, locksForId.add(this.db))
        this.session = { abortController: new AbortController() }
        return this.session
      }
    }

    // Postgres implementation uses advisory locking, automatically released by ending connection.

    const client = await this.db.cfg.pool.connect()
    try {
      const lock = await client.query(
        'SELECT pg_try_advisory_lock($1) as acquired',
        [this.id],
      )
      if (!lock.rows[0].acquired) {
        client.release()
        return null
      }
    } catch (err) {
      client.release(true)
      throw err
    }

    const abortController = new AbortController()
    client.once('error', (err) => abortController.abort(err))
    this.session = { abortController, client }
    return this.session
  }

  private release() {
    if (this.db.cfg.dialect === 'sqlite') {
      Leader.inProcessLocks.get(this.id)?.delete(this.db)
    } else {
      // The flag ensures the connection is destroyed on release, not reused.
      // This is required, as that is how the pg advisory lock is released.
      this.session?.client?.release(true)
    }
    this.session = null
  }
}

type Session = { abortController: AbortController; client?: PoolClient }

type RunResult<T> = { ran: false } | { ran: true; result: T }

// Mini system for coordinated app-level migrations.

const APP_MIGRATION_LOCK_ID = 1100

export async function appMigration(
  db: Database,
  id: string,
  runMigration: (tx: Database) => Promise<void>,
) {
  // Ensure migration is tracked in a table
  await ensureMigrationTracked(db, id)

  // If the migration has already completed, succeed/fail with it (fast path, no locks)
  const status = await checkMigrationStatus(db, id)
  if (status === MigrationStatus.Succeeded) {
    return
  } else if (status === MigrationStatus.Failed) {
    throw new Error('Migration previously failed')
  }

  // Take a lock for potentially running an app migration
  const disposeLock = await acquireMigrationLock(db)
  try {
    // If the migration has already completed, succeed/fail with it
    const status = await checkMigrationStatus(db, id)
    if (status === MigrationStatus.Succeeded) {
      return
    } else if (status === MigrationStatus.Failed) {
      throw new Error('Migration previously failed')
    }
    // Run the migration and update migration state
    try {
      await db.transaction(runMigration)
      await completeMigration(db, id, 1)
    } catch (err) {
      await completeMigration(db, id, 0)
      throw err
    }
  } finally {
    // Ensure lock is released
    disposeLock()
  }
}

async function checkMigrationStatus(db: Database, id: string) {
  const migration = await db.db
    .selectFrom('app_migration')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  if (!migration.completedAt) {
    return MigrationStatus.Running
  }
  return migration.success ? MigrationStatus.Succeeded : MigrationStatus.Failed
}

async function acquireMigrationLock(db: Database) {
  if (db.cfg.dialect !== 'pg') {
    throw new Error('App migrations are pg-only')
  }
  const client = await db.cfg.pool.connect()
  const dispose = () => client.release(true)
  try {
    // Blocks until lock is acquired
    await client.query('SELECT pg_advisory_lock($1)', [APP_MIGRATION_LOCK_ID])
  } catch (err) {
    dispose()
    throw err
  }
  return dispose
}

async function completeMigration(db: Database, id: string, success: 0 | 1) {
  await db.db
    .updateTable('app_migration')
    .where('id', '=', id)
    .where('completedAt', 'is', null)
    .set({ success, completedAt: new Date().toISOString() })
    .executeTakeFirst()
}

async function ensureMigrationTracked(db: Database, id: string) {
  await db.db
    .insertInto('app_migration')
    .values({ id, success: 0 })
    .onConflict((oc) => oc.doNothing())
    .returningAll()
    .execute()
}

enum MigrationStatus {
  Succeeded,
  Failed,
  Running,
}
