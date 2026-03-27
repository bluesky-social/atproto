import { MINUTE } from '@atproto/common'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { ReportStatsServiceCreator } from '../report/stats'

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
    const statsService = this.reportStatsServiceCreator(this.db)
    await statsService.materializeAll()
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
