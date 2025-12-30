import { sql } from 'kysely'
import { MINUTE } from '@atproto/common'
import { BackgroundQueue, PeriodicBackgroundTask } from '../background'
import { dbLogger } from '../logger'

export class MaterializedViewRefresher extends PeriodicBackgroundTask {
  constructor(backgroundQueue: BackgroundQueue, interval = 30 * MINUTE) {
    super(backgroundQueue, interval, async ({ db }, signal) => {
      for (const view of [
        'account_events_stats',
        'record_events_stats',
        'account_record_events_stats',
        'account_record_status_stats',
      ]) {
        if (signal.aborted) break

        // Kysely does not provide a way to cancel a running query. Because of
        // this, killing the process during a refresh will cause the process to
        // wait for the current refresh to finish before exiting. This is not
        // ideal, but it is the best we can do until Kysely provides a way to
        // cancel a query.
        try {
          await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ${sql.id(view)}`.execute(
            db,
          )
          dbLogger.info(`refreshed materialized view ${view}`)
        } catch (err) {
          dbLogger.error({ err, view }, 'failed to refresh materialized view')
        }
      }
    })
  }
}
