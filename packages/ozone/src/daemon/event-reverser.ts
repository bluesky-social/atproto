import { MINUTE } from '@atproto/common'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { ModerationServiceCreator, ReversalSubject } from '../mod-service'

export class EventReverser {
  destroyed = false
  reversalPromise: Promise<void> = Promise.resolve()
  timer?: NodeJS.Timeout

  constructor(
    private db: Database,
    private modService: ModerationServiceCreator,
  ) {}

  start() {
    this.poll()
  }

  poll() {
    if (this.destroyed) return
    this.reversalPromise = this.findAndRevertDueActions()
      .catch((err) =>
        dbLogger.error({ err }, 'moderation action reversal errored'),
      )
      .finally(() => {
        this.timer = setTimeout(() => this.poll(), getInterval())
      })
  }

  async destroy() {
    this.destroyed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    await this.reversalPromise
  }

  async revertState(subject: ReversalSubject) {
    await this.db.transaction(async (dbTxn) => {
      const moderationTxn = this.modService(dbTxn)
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
    const moderationService = this.modService(this.db)
    const subjectsDueForReversal =
      await moderationService.getSubjectsDueForReversal()

    // We shouldn't have too many actions due for reversal at any given time, so running in parallel is probably fine
    // Internally, each reversal runs within its own transaction
    await Promise.all(subjectsDueForReversal.map(this.revertState.bind(this)))
  }
}

const getInterval = (): number => {
  // super basic synchronization by agreeing when the intervals land relative to unix timestamp
  const now = Date.now()
  const intervalMs = MINUTE
  const nextIteration = Math.ceil(now / intervalMs)
  return nextIteration * intervalMs - now
}
