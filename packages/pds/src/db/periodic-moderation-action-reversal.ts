import assert from 'assert'
import { wait } from '@atproto/common'
import { Leader } from './leader'
import { dbLogger } from '../logger'
import Database from '.'
import AppContext from '../context'

export const MODERATION_ACTION_REVERSAL_ID = 1011

export class PeriodicModerationActionReversal {
  leader = new Leader(MODERATION_ACTION_REVERSAL_ID, this.db)
  destroyed = false

  constructor(public db: Database, private appContext: AppContext) {
    assert(
      this.db.dialect === 'pg',
      'Moderation action reversal can only be run by postgres',
    )
  }

  async revertAction({ id, createdBy }: { id: number; createdBy: string }) {
    return this.db.transaction(async (dbTxn) => {
      const moderationTxn = this.appContext.services.moderation(dbTxn)
      await moderationTxn.revertAction({
        id,
        createdBy,
        createdAt: new Date(),
        reason: `[SCHEDULED_REVERSAL] Reverting action as originally scheduled`,
      })
    })
  }

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          // TODO: Figure out how to incorporate signal dependency in here
          // TODO: Write tests to ensure that this is working
          const moderationService = this.appContext.services.moderation(this.db)
          const actionsDueForReversal =
            await moderationService.getActionsDueForReversal()

          Promise.allSettled(
            actionsDueForReversal.map(this.revertAction.bind(this)),
          )
        })
        if (ran && !this.destroyed) {
          throw new Error('View maintainer completed, but should be persistent')
        }
      } catch (err) {
        dbLogger.error(
          {
            err,
            lockId: MODERATION_ACTION_REVERSAL_ID,
          },
          'moderation action reversal errored',
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
