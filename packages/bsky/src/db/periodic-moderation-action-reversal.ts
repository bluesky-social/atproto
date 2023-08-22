import { wait } from '@atproto/common'
import { Leader } from './leader'
import { dbLogger } from '../logger'
import AppContext from '../context'
import AtpAgent from '@atproto/api'
import { buildBasicAuth } from '../auth'
import { LabelService } from '../services/label'
import { ModerationActionRow } from '../services/moderation'

export const MODERATION_ACTION_REVERSAL_ID = 1011

export class PeriodicModerationActionReversal {
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

  // invert label creation & negations
  async reverseLabels(labelTxn: LabelService, actionRow: ModerationActionRow) {
    let uri: string
    let cid: string | null = null

    if (actionRow.subjectUri && actionRow.subjectCid) {
      uri = actionRow.subjectUri
      cid = actionRow.subjectCid
    } else {
      uri = actionRow.subjectDid
    }

    await labelTxn.formatAndCreate(this.appContext.cfg.labelerDid, uri, cid, {
      create: actionRow.negateLabelVals
        ? actionRow.negateLabelVals.split(' ')
        : undefined,
      negate: actionRow.createLabelVals
        ? actionRow.createLabelVals.split(' ')
        : undefined,
    })
  }

  async revertAction(actionRow: ModerationActionRow) {
    const reverseAction = {
      id: actionRow.id,
      createdBy: actionRow.createdBy,
      createdAt: new Date(),
      reason: `[SCHEDULED_REVERSAL] Reverting action as originally scheduled`,
    }

    if (this.pushAgent) {
      await this.pushAgent.com.atproto.admin.reverseModerationAction(
        reverseAction,
      )
      return
    }

    await this.appContext.db.getPrimary().transaction(async (dbTxn) => {
      const moderationTxn = this.appContext.services.moderation(dbTxn)
      await moderationTxn.revertAction(reverseAction)
      const labelTxn = this.appContext.services.label(dbTxn)
      await this.reverseLabels(labelTxn, actionRow)
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
