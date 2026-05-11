import { sql } from 'kysely'
import { MINUTE } from '@atproto/common'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { ReportStatsServiceCreator } from '../report/stats'

// Stable lock ID for pg_try_advisory_lock across all instances
const ADVISORY_LOCK_ID = 7_239_401

/**
 * Background daemon that materializes report statistics on an interval (default is 15 minutes).
 *
 * Each cycle computes calendar-day snapshots: today's stats are recomputed (in-progress day),
 * and yesterday's snapshot is finalized if it wasn't already. Historical snapshots (completed
 * days) are write-once and never recomputed unless explicitly refreshed via the API.
 *
 * Query profile per cycle (assuming ~10K reports/day, 10 queues, 20 moderators, 9 type groups):
 * - 7 batched GROUP BY queries against the report table for today's date window
 *   (+ 7 more for yesterday if finalization is needed).
 *   Day-window queries scan ~10K rows. Pending-count queries use partial indexes
 *   (WHERE status != 'closed') so only scan open reports, not the full table.
 *   Expected: ~10-50ms per query, ~100-350ms total report-table time.
 * - ~40 lightweight reads against report_stat for freshness checks (small indexed table).
 * - ~40 lightweight writes to report_stat for upserts.
 *
 * Locking: Uses pg_try_advisory_lock to ensure only one instance materializes at a time
 * when running multiple containers. Advisory locks are cooperative, session-level locks —
 * they do NOT block any table reads, writes, row locks, or transactions from other sessions.
 * Normal application queries (report creation, moderation actions, API reads) are completely
 * unaffected. If another instance already holds the lock, this instance skips the cycle
 * immediately without blocking.
 */
export class StatsComputer {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private reportStatsServiceCreator: ReportStatsServiceCreator,
    /**
     * Minutes between stats computer cycles.
     * Defaults to 15. Minimum is 1.
     * Set to -1 to disable the stats computer.
     */
    private intervalMinutes: number,
  ) {}

  get disabled() {
    return this.intervalMinutes < 1
  }

  start() {
    this.poll()
  }

  poll() {
    if (this.destroyed || this.disabled) return
    this.processingPromise = this.materializeStats()
      .catch((err) => dbLogger.error({ err }, 'stats materialization errored'))
      .finally(() => {
        this.timer = setTimeout(
          () => this.poll(),
          this.intervalMinutes * MINUTE,
        )
      })
  }

  private async materializeStats() {
    const lockResult = await sql<{
      locked: boolean
    }>`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as locked`.execute(
      this.db.db,
    )
    const acquired = lockResult.rows[0]?.locked === true
    if (!acquired) {
      dbLogger.info(
        'stats materialization skipped, another instance holds lock',
      )
      return
    }

    try {
      const statsService = this.reportStatsServiceCreator(this.db)
      await statsService.materializeAll()
    } finally {
      await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`.execute(
        this.db.db,
      )
    }
  }

  async destroy() {
    this.destroyed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    await this.processingPromise
  }
}
