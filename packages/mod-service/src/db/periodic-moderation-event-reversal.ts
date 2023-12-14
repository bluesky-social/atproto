import { wait } from '@atproto/common'
import { Leader } from './leader'
import { dbLogger } from '../logger'
import AppContext from '../context'
import { AtUri } from '@atproto/api'
import { ModerationSubjectStatusRow } from '../services/moderation/types'
import { CID } from 'multiformats/cid'
import AtpAgent from '@atproto/api'
import { retryHttp } from '../util/retry'

export const MODERATION_ACTION_REVERSAL_ID = 1011

export class PeriodicModerationEventReversal {
  leader = new Leader(
    MODERATION_ACTION_REVERSAL_ID,
    this.appContext.db.getPrimary(),
  )
  destroyed = false
  pushAgent?: AtpAgent

  constructor(private appContext: AppContext) {
    this.pushAgent = appContext.moderationPushAgent
  }

  async revertState(eventRow: ModerationSubjectStatusRow) {
    await this.appContext.db.getPrimary().transaction(async (dbTxn) => {
      const moderationTxn = this.appContext.services.moderation(dbTxn)
      const originalEvent =
        await moderationTxn.getLastReversibleEventForSubject(eventRow)
      if (originalEvent) {
        const { restored } = await moderationTxn.revertState({
          action: originalEvent.action,
          createdBy: originalEvent.createdBy,
          comment:
            '[SCHEDULED_REVERSAL] Reverting action as originally scheduled',
          subject:
            eventRow.recordPath && eventRow.recordCid
              ? {
                  uri: AtUri.make(
                    eventRow.did,
                    ...eventRow.recordPath.split('/'),
                  ),
                  cid: CID.parse(eventRow.recordCid),
                }
              : { did: eventRow.did },
          createdAt: new Date(),
        })

        const { pushAgent } = this
        if (
          originalEvent.action === 'com.atproto.admin.defs#modEventTakedown' &&
          restored?.subjects?.length &&
          pushAgent
        ) {
          await Promise.allSettled(
            restored.subjects.map((subject) =>
              retryHttp(() =>
                pushAgent.api.com.atproto.admin.updateSubjectStatus({
                  subject,
                  takedown: {
                    applied: false,
                  },
                }),
              ),
            ),
          )
        }
      }
    })
  }

  async findAndRevertDueActions() {
    const moderationService = this.appContext.services.moderation(
      this.appContext.db.getPrimary(),
    )
    const subjectsDueForReversal =
      await moderationService.getSubjectsDueForReversal()

    // We shouldn't have too many actions due for reversal at any given time, so running in parallel is probably fine
    // Internally, each reversal runs within its own transaction
    await Promise.all(subjectsDueForReversal.map(this.revertState.bind(this)))
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
            await this.findAndRevertDueActions()
          }
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
