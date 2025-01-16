import { MINUTE } from '@atproto/common'
import Database from '../db'
import { sql } from 'kysely'
import { PeriodicBackgroundTask } from '../background'

export class MaterializedViewRefresher extends PeriodicBackgroundTask {
  constructor(db: Database) {
    super(db, 15 * MINUTE, async ({ db }, signal) => {
      for (const view of [
        'account_events_stats',
        'record_events_stats',
        'account_record_events_stats',
        'account_record_status_stats',
      ]) {
        if (signal.aborted) break
        await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ${sql.id(view)}`.execute(
          db,
        )
      }
    })
  }
}
