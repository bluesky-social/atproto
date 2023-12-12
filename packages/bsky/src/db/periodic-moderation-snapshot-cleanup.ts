import { wait } from '@atproto/common'
import { Leader } from './leader'
import { dbLogger } from '../logger'
import AppContext from '../context'

export const MODERATION_SNAPSHOT_CLEANUP_ID = 1012

export class PeriodicModerationSnapshotCleanup {
  leader = new Leader(
    MODERATION_SNAPSHOT_CLEANUP_ID,
    this.appContext.db.getPrimary(),
  )
  destroyed = false

  constructor(private appContext: AppContext) {}

  async findAndCleanupExpiredSnapshots() {
    const moderationService = this.appContext.services.moderation(
      this.appContext.db.getPrimary(),
    )

    await moderationService.cleanupExpiredRecordSnapshots(
      this.appContext.cfg.moderationSnapshotExpiryInDays || 30,
    )
  }

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          while (!signal.aborted) {
            // super basic synchronization by agreeing when the intervals land relative to unix timestamp
            const now = Date.now()
            const intervalMs = 1000 * 60
            const nextIteration = Math.ceil(now / intervalMs)
            const nextInMs = nextIteration * intervalMs - now
            await wait(nextInMs)
            if (signal.aborted) break
            await this.findAndCleanupExpiredSnapshots()
          }
        })
        if (ran && !this.destroyed) {
          throw new Error(
            'Moderation snapshot cleanup completed, but should be persistent',
          )
        }
      } catch (err) {
        dbLogger.error(
          {
            err,
            lockId: MODERATION_SNAPSHOT_CLEANUP_ID,
          },
          'moderation snapshot cleanup errored',
        )
      }
      if (!this.destroyed) {
        await wait(10000 + jitter(2000))
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy()
  }
}

function jitter(maxMs) {
  return Math.round((Math.random() - 0.5) * maxMs * 2)
}
