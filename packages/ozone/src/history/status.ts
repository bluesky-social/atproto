import Database from '../db'
import { PublicSubjectStatus } from '../db/schema/public_subject_status'
import {
  REVIEWCLOSED,
  REVIEWNONE,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { getStatusIdentifierFromSubject } from '../mod-service/status'
import { ModerationEventRow } from '../mod-service/types'

const modEventsAssociatedWithPublicStatus = [
  'tools.ozone.moderation.defs#modEventAcknowledge',
  'tools.ozone.moderation.defs#modEventLabel',
  'tools.ozone.moderation.defs#modEventTakedown',
  'tools.ozone.moderation.defs#modEventReverseTakedown',
]

export class ModerationStatusHistory {
  constructor(private db: Database) {}

  async adjustStatusForEvent(event: ModerationEventRow) {
    const identifier = getStatusIdentifierFromSubject(
      event.subjectUri || event.subjectDid,
    )
    const currentStatus = await this.getStatus(identifier)
    const defaultReviewState = currentStatus
      ? currentStatus.reviewState
      : REVIEWNONE

    const updates: Partial<Pick<PublicSubjectStatus, 'reviewState'>> = {}

    switch (event.action) {
      case 'tools.ozone.moderation.defs#modEventAcknowledge':
        updates.reviewState = REVIEWCLOSED
    }

    // No updates necessary
    if (Object.keys(updates).length === 0) {
      return null
    }

    return this.db.db
      .updateTable('public_subject_status')
      .where('did', '=', identifier.did)
      .if(!!identifier.recordPath, (query) =>
        query.where('recordPath', '=', identifier.recordPath),
      )
      .set(updates)
      .executeTakeFirst()
  }

  async getStatus(identifier: { did: string; recordPath: string }) {
    return this.db.db
      .selectFrom('public_subject_status')
      .where('did', '=', identifier.did)
      .if(!!identifier.recordPath, (query) =>
        query.where('recordPath', '=', identifier.recordPath),
      )
      .selectAll()
      .executeTakeFirst()
  }
}
