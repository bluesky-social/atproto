import { sql } from 'kysely'
import { MINUTE } from '@atproto/common'
import { type Database, STATS_COMPUTER_LOCK_ID } from '../db/index.js'
import { dbLogger } from '../logger.js'
import type { ReportStatsServiceCreator } from '../report/stats.js'

/**
 * Background daemon that materializes report statistics on an interval (default is 15 minutes).
 *
 * Each cycle computes calendar-day snapshots: today's stats are recomputed (in-progress day),
 * and yesterday's snapshot is finalized if it wasn't already. Historical snapshots (completed
 * days) are write-once and never recomputed unless explicitly refreshed via the API.
 *
 * Each materialization batches inbound, pending, and lifecycle aggregation queries,
 * then replaces the small set of daily aggregate, queue, reason, and moderator rows.
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
    const startedAt = Date.now()
    const lockResult = await sql<{
      locked: boolean
    }>`SELECT pg_try_advisory_lock(${STATS_COMPUTER_LOCK_ID}) as locked`.execute(
      this.db.db,
    )
    const acquired = lockResult.rows[0]?.locked === true
    if (!acquired) {
      dbLogger.info(
        { event: 'stats_computer_lock_skip', lockSkipped: 1 },
        'stats materialization skipped, another instance holds lock',
      )
      return
    }

    try {
      const statsService = this.reportStatsServiceCreator(this.db)
      const { rowsWritten } = await statsService.materializeAll()
      const today = new Date().toISOString().slice(0, 10)
      const latest = await this.db.db
        .selectFrom('report_stat')
        .select(sql<string | null>`max("computedAt")`.as('computedAt'))
        .where('date', '=', today)
        .executeTakeFirst()
      const stalenessMs = latest?.computedAt
        ? Math.max(0, Date.now() - new Date(latest.computedAt).getTime())
        : null
      dbLogger.info(
        {
          event: 'stats_computer_cycle',
          durationMs: Date.now() - startedAt,
          rowsWritten,
          stalenessMs,
        },
        'stats computer cycle completed',
      )
    } finally {
      await sql`SELECT pg_advisory_unlock(${STATS_COMPUTER_LOCK_ID})`.execute(
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
