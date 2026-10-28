import { sql } from 'kysely'
import type { Database } from '../db/index.js'
import { dbLogger } from '../logger.js'

/** Keep optional inbox work from aborting the source transaction on SQL errors. */
export async function runNotificationWork<T>(
  db: Database,
  work: (db: Database) => Promise<T>,
): Promise<T | undefined> {
  if (!db.isTransaction) {
    return db.transaction((txn) => runNotificationWork(txn, work))
  }
  await sql`savepoint inbox_notification_work`.execute(db.db)
  try {
    const result = await work(db)
    await sql`release savepoint inbox_notification_work`.execute(db.db)
    return result
  } catch (err) {
    // @NOTE Catching alone leaves PostgreSQL's transaction aborted.
    await sql`rollback to savepoint inbox_notification_work`.execute(db.db)
    await sql`release savepoint inbox_notification_work`.execute(db.db)
    dbLogger.error({ err }, 'inbox notification work failed')
    return undefined
  }
}
