import { MINUTE } from '@atproto/common'
import { sql } from 'kysely'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { ReportStatsServiceCreator } from '../report/stats'

// Stable lock ID for pg_try_advisory_lock across all instances
const ADVISORY_LOCK_ID = 7_239_401

export class StatsComputer {
  destroyed = false
  processingPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private reportStatsServiceCreator: ReportStatsServiceCreator,
  ) {}

  start() {
    this.poll()
  }

  poll() {
    if (this.destroyed) return
    this.processingPromise = this.materializeStats()
      .catch((err) => dbLogger.error({ err }, 'stats materialization errored'))
      .finally(() => {
        this.timer = setTimeout(() => this.poll(), getInterval())
      })
  }

  private async materializeStats() {
    // Acquire a session-level advisory lock so only one instance materializes at a time.
    // pg_try_advisory_lock returns false immediately if another session holds the lock.
    const lockResult = await sql<{
      locked: boolean
    }>`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as locked`.execute(
      this.db.db,
    )
    const acquired = lockResult.rows[0]?.locked === true
    if (!acquired) {
      dbLogger.info('stats materialization skipped, another instance holds lock')
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

// Poll every 15 minutes
const getInterval = (): number => 15 * MINUTE
