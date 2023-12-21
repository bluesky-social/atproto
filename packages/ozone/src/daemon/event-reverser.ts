import { MINUTE, wait } from '@atproto/common'
import { dbLogger } from '../logger'
import { ReversalSubject } from '../services/moderation'
import Database from '../db'
import { Services } from '../services'

export class EventReverser {
  destroyed = false
  reversalPromise: Promise<void> = Promise.resolve()

  constructor(private db: Database, private services: Services) {}

  start() {
    this.reversalPromise = this.poll()
  }

  async poll() {
    if (this.destroyed) return
    try {
      await this.findAndRevertDueActions()
    } catch (err) {
      dbLogger.error({ err }, 'moderation action reversal errored')
    }
    await waitForInterval()
    this.reversalPromise = this.poll()
  }

  async destroy() {
    this.destroyed = true
    await this.reversalPromise
  }

  async revertState(subject: ReversalSubject) {
    await this.db.transaction(async (dbTxn) => {
      const moderationTxn = this.services.moderation(dbTxn)
      const originalEvent =
        await moderationTxn.getLastReversibleEventForSubject(subject)
      if (originalEvent) {
        await moderationTxn.revertState({
          action: originalEvent.action,
          createdBy: originalEvent.createdBy,
          comment:
            '[SCHEDULED_REVERSAL] Reverting action as originally scheduled',
          subject: subject.subject,
          createdAt: new Date(),
        })
      }
    })
  }

  async findAndRevertDueActions() {
    const moderationService = this.services.moderation(this.db)
    const subjectsDueForReversal =
      await moderationService.getSubjectsDueForReversal()

    // We shouldn't have too many actions due for reversal at any given time, so running in parallel is probably fine
    // Internally, each reversal runs within its own transaction
    await Promise.all(subjectsDueForReversal.map(this.revertState.bind(this)))
  }
}

const waitForInterval = async () => {
  // super basic synchronization by agreeing when the intervals land relative to unix timestamp
  const now = Date.now()
  const intervalMs = MINUTE
  const nextIteration = Math.ceil(now / intervalMs)
  const nextInMs = nextIteration * intervalMs - now
  await wait(nextInMs)
}
