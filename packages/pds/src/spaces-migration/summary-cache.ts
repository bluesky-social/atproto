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
  /** How long a requested refresh waits, so a burst costs one query. */
  debounceMs?: number
}

/**
 * Keeps the latest migration summary in memory for the health endpoint, so
 * that no request queries the DB. Refreshed on an interval, and soon after
 * each recorded transition. A failed refresh keeps the last summary.
 */
export class SpacesMigrationSummaryCache implements AsyncDisposable {
  /** Undefined until the first refresh completes. */
  latest?: SpacesMigrationSummary

  private readonly intervalMs: number
  private readonly debounceMs: number
  private running?: Promise<void>
  private destroyed = false
  private requested = false
  private debouncing = false
  private waiter?: BailableWait

  constructor(
    private readonly source: SummarySource,
    opts: SpacesMigrationSummaryCacheOptions = {},
  ) {
    this.intervalMs = opts.intervalMs ?? MINUTE
    this.debounceMs = opts.debounceMs ?? SECOND
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
    }
  }

  /** Asks for a refresh after the debounce delay. */
  refreshSoon(): void {
    this.requested = true
    if (!this.debouncing) this.waiter?.bail()
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
      // Requests during the delay join the pending refresh
      this.debouncing = true
      if (this.requested) await this.sleep(this.debounceMs)
      this.debouncing = false
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
