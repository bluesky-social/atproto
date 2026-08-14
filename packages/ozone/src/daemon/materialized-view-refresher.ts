import { MINUTE } from '@atproto/common'
import { type BackgroundQueue, PeriodicBackgroundTask } from '../background.js'
import { MATERIALIZED_VIEW_REFRESH_LOCK_ID } from '../db/index.js'
import { dbLogger } from '../logger.js'

const LOCK_TIMEOUT_MS = 1 * MINUTE

export class MaterializedViewRefresher extends PeriodicBackgroundTask {
  constructor(
    backgroundQueue: BackgroundQueue,
    interval = 30 * MINUTE,
    statementTimeoutMs = 10 * MINUTE,
  ) {
    super(backgroundQueue, interval, async (db, signal) => {
      let locked = false
      // Create single client for the whole refresh cycle
      const client = await db.pool.connect()
      const lockScope = db.opts.schema ?? 'public'

      try {
        await client.query(`SET statement_timeout = ${statementTimeoutMs}`)
        await client.query(`SET lock_timeout = ${LOCK_TIMEOUT_MS}`)

        const lockResult = await client.query(
          `SELECT pg_try_advisory_lock(
            hashtextextended(current_database() || ':' || $2::text, $1)
          ) as locked`,
          [MATERIALIZED_VIEW_REFRESH_LOCK_ID, lockScope],
        )
        locked = lockResult.rows[0]?.locked === true
        if (!locked) {
          dbLogger.info('lock is held - skipping materialized view refresh')
          return
        }

        for (const view of [
          'account_events_stats',
          'record_events_stats',
          'account_record_events_stats',
          'account_record_status_stats',
        ]) {
          if (signal.aborted) break

          const startedAt = Date.now()
          try {
            await client.query(
              `REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`,
            )
            dbLogger.info(
              { view, durationMs: Date.now() - startedAt },
              'refreshed materialized view',
            )
          } catch (err) {
            dbLogger.error(
              { err, view, durationMs: Date.now() - startedAt },
              'failed to refresh materialized view',
            )
          }
        }
      } finally {
        try {
          if (locked) {
            await client.query(
              `SELECT pg_advisory_unlock(
                hashtextextended(current_database() || ':' || $2::text, $1)
              )`,
              [MATERIALIZED_VIEW_REFRESH_LOCK_ID, lockScope],
            )
          }
        } finally {
          // Discard the session so its SET values cannot leak into the pool.
          client.release(true)
        }
      }
    })
  }
}
