import { wait } from '@atproto/common'
import { Leader } from './leader'
import { dbLogger } from '../logger'
import AppContext from '../context'
import AtpAgent, { AtUri } from '@atproto/api'
import { buildBasicAuth } from '../auth'
import { ModerationEventRow } from '../services/moderation/types'
import { CID } from 'multiformats/cid'

export const MODERATION_ACTION_REVERSAL_ID = 1011

export class PeriodicModerationEventReversal {
  leader = new Leader(
    MODERATION_ACTION_REVERSAL_ID,
    this.appContext.db.getPrimary(),
  )
  destroyed = false
  pushAgent?: AtpAgent

  constructor(private appContext: AppContext) {
    if (appContext.cfg.moderationActionReverseUrl) {
      const url = new URL(appContext.cfg.moderationActionReverseUrl)
      this.pushAgent = new AtpAgent({ service: url.origin })
      this.pushAgent.api.setHeader(
        'authorization',
        buildBasicAuth(url.username, url.password),
      )
    }
  }

  async revertAction(actionRow: ModerationEventRow) {
    const reverseAction = {
      id: actionRow.id,
      createdBy: actionRow.createdBy,
      createdAt: new Date(),
      // TODO: do we need to take care of blob cid separately here?
      subject:
        actionRow.subjectUri && actionRow.subjectCid
          ? {
              uri: new AtUri(actionRow.subjectUri),
              cid: CID.parse(actionRow.subjectCid),
            }
          : { did: actionRow.subjectDid },
      comment: `[SCHEDULED_REVERSAL] Reverting action as originally scheduled`,
    }

    // TODO: do we still need this?
    // if (this.pushAgent) {
    //   await this.pushAgent.com.atproto.admin.reverseModerationEvent(
    //     reverseAction,
    //   )
    //   return
    // }

    await this.appContext.db.getPrimary().transaction(async (dbTxn) => {
      const moderationTxn = this.appContext.services.moderation(dbTxn)
      const labelTxn = this.appContext.services.label(dbTxn)
      await moderationTxn.revertAction(reverseAction, async (labelParams) =>
        labelTxn.formatAndCreate(
          this.appContext.cfg.labelerDid,
          labelParams.subjectUri ?? labelParams.subjectDid,
          labelParams.subjectCid,
          {
            create: labelParams.createLabelVals?.length
              ? labelParams.createLabelVals.split(' ')
              : undefined,
            negate: labelParams.negateLabelVals?.length
              ? labelParams.negateLabelVals.split(' ')
              : undefined,
          },
        ),
      )
    })
  }

  async findAndRevertDueActions() {
    const moderationService = this.appContext.services.moderation(
      this.appContext.db.getPrimary(),
    )
    const actionsDueForReversal =
      await moderationService.getActionsDueForReversal()

    // We shouldn't have too many actions due for reversal at any given time, so running in parallel is probably fine
    // Internally, each reversal runs within its own transaction
    await Promise.all(actionsDueForReversal.map(this.revertAction.bind(this)))
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
