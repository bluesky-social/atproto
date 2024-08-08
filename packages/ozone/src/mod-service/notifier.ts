import Database from '../db'
import { ModerationEventRow, ModerationSubjectStatusRow } from './types'

export class ModerationNotifierService {
  private db: Database
  private event: ModerationEventRow
  private subjectStatus: ModerationSubjectStatusRow | null

  private eventsThatRequireReporterNotification = [
    'tools.ozone.moderation.defs#modEventTakedown',
    'tools.ozone.moderation.defs#modEventLabel',
  ]

  constructor(
    db: Database,
    {
      event,
      subjectStatus,
    }: {
      event: ModerationEventRow
      subjectStatus: ModerationSubjectStatusRow | null
    },
  ) {
    this.db = db
    this.event = event
    this.subjectStatus = subjectStatus
  }

  private shouldNotifyReporters() {
    return (
      this.eventsThatRequireReporterNotification.includes(this.event.action) &&
      this.subjectStatus
    )
  }

  private async getReportersToBeNotified(): Promise<string[]> {
    const query = this.db.db
      .selectFrom('moderation_event')
      .where('action', '=', 'tools.ozone.moderation.defs#modEventReport')
      .where('subjectType', '=', this.event.subjectType)
      .where('subjectDid', '=', this.event.subjectDid)
      .where((qb) => {
        if (this.event.subjectUri) {
          return qb.where('subjectUri', '=', this.event.subjectUri)
        }
        return qb.where('subjectUri', 'is', null)
      })
      .where('id', '<', this.event.id)
      .where('id', '>', (qb) => {
        // Find the last moderation event that would have triggered a notification
        return qb
          .selectFrom('moderation_event')
          .where('subjectType', '=', this.event.subjectType)
          .where('subjectDid', '=', this.event.subjectDid)
          .where('action', 'in', this.eventsThatRequireReporterNotification)
          .where('id', '<', this.event.id)
          .orderBy('id', 'desc')
          .select(({ fn }) => fn.max('id').as('id'))
      })
      .select('createdBy')
      .distinct()

    const reporterDids = await query.execute()
    return reporterDids.map((row) => row.createdBy)
  }

  async notifyReporters(): Promise<boolean> {
    if (!this.shouldNotifyReporters()) {
      return false
    }

    const reporterDids = await this.getReportersToBeNotified()
    if (!reporterDids.length) {
      return false
    }

    // TODO: Actually send out notifications to the reporters here

    return true
  }
}
