import {
  type BailableWait,
  MINUTE,
  SECOND,
  bailableWait,
} from '@atproto/common'
import { spacesMigrationLogger as log } from '../logger.js'
import type { SpacesMigrationSummary } from './progress.js'

export type SummarySource = { summary(): Promise<SpacesMigrationSummary> }

export type SpacesMigrationSummaryCacheOptions = {
  /** How often to refresh regardless of transitions. */
  intervalMs?: number
  /**
   * The least time between refreshes. Transitions within it share one
   * refresh, so a busy sweep doesn't scan the table every few seconds.
   */
  minGapMs?: number
}

/**
 * Keeps the latest migration summary in memory for the health endpoint, so
 * that no request queries the DB. Refreshed on an interval, and soon after
 * each recorded transition, though never twice within `minGapMs`. A failed
 * refresh keeps the last summary.
 */
export class SpacesMigrationSummaryCache implements AsyncDisposable {
  /** Undefined until the first refresh completes. */
  latest?: SpacesMigrationSummary

  private readonly intervalMs: number
  private readonly minGapMs: number
  private running?: Promise<void>
  private destroyed = false
  private requested = false
  private gapping = false
  private lastRefreshAt = 0
  private waiter?: BailableWait

  constructor(
    private readonly source: SummarySource,
    opts: SpacesMigrationSummaryCacheOptions = {},
  ) {
    this.intervalMs = opts.intervalMs ?? MINUTE
    this.minGapMs = opts.minGapMs ?? 10 * SECOND
  }

  start(): void {
    this.running ??= this.run()
  }

  /** Queries the summary now. Never throws. */
  async refresh(): Promise<void> {
    try {
      this.latest = await this.source.summary()
    } catch (err) {
      log.error({ err }, 'failed to refresh spaces migration summary')
    } finally {
      this.lastRefreshAt = Date.now()
    }
  }

  /** Asks for a refresh once `minGapMs` has passed since the last one. */
  refreshSoon(): void {
    this.requested = true
    if (!this.gapping) this.waiter?.bail()
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    this.waiter?.bail()
    await this.running
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy()
  }

  private async run(): Promise<void> {
    await this.refresh()
    while (!this.destroyed) {
      if (!this.requested) await this.sleep(this.intervalMs)
      if (this.destroyed) break
      if (this.requested) {
        // Requests during the gap join the pending refresh
        this.gapping = true
        await this.sleep(this.lastRefreshAt + this.minGapMs - Date.now())
        this.gapping = false
      }
      if (this.destroyed) break
      this.requested = false
      await this.refresh()
    }
  }

  private async sleep(ms: number): Promise<void> {
    this.waiter = bailableWait(Math.max(0, ms))
    await this.waiter.wait()
    this.waiter = undefined
  }
}
