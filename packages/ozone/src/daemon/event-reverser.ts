import { MINUTE } from '@atproto/common'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { ModerationServiceCreator, ReversalSubject } from '../mod-service'
import {
  deleteExpiringTagsByIds,
  getExpiredTags,
} from '../mod-service/expiring-tags'
import { subjectFromStatusRow } from '../mod-service/subject'

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

    await this.findAndRevertExpiredTags()
  }

  async findAndRevertExpiredTags() {
    const groups = await getExpiredTags(this.db)
    if (!groups.length) return

    for (const group of groups) {
      await this.db.transaction(async (dbTxn) => {
        // Check which tags are still present on the subject
        const status = await dbTxn.db
          .selectFrom('moderation_subject_status')
          .where('did', '=', group.did)
          .where('recordPath', '=', group.recordPath)
          .selectAll()
          .executeTakeFirst()

        const currentTags: string[] = status?.tags ?? []
        const tagsToRemove = group.tags.filter((t) => currentTags.includes(t))

        // Delete the expiring_tag rows regardless
        await deleteExpiringTagsByIds(dbTxn, group.ids)

        // Only emit removal event if there are tags still present to remove
        if (tagsToRemove.length > 0 && status) {
          const subject = subjectFromStatusRow(status)
          const moderationTxn = this.modService(dbTxn)
          await moderationTxn.logEvent({
            event: {
              $type: 'tools.ozone.moderation.defs#modEventTag',
              add: [],
              remove: tagsToRemove,
              comment:
                '[SCHEDULED_REVERSAL] Reverting temporary tags as originally scheduled',
            },
            createdBy: group.createdBy,
            subject,
            createdAt: new Date(),
          })
        }
      })
    }
  }
}

const getInterval = (): number => {
  // super basic synchronization by agreeing when the intervals land relative to unix timestamp
  const now = Date.now()
  const intervalMs = MINUTE
  const nextIteration = Math.ceil(now / intervalMs)
  return nextIteration * intervalMs - now
}
