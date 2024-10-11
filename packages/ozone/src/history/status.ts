import { Selectable, sql } from 'kysely'
import Database from '../db'
import { paginate, TimeIdKeyset } from '../db/pagination'
import { PublicSubjectStatus } from '../db/schema/public_subject_status'
import {
  MODACTIONLABEL,
  MODACTIONPENDING,
  MODACTIONRESOLVE,
  MODACTIONSUSPEND,
  MODACTIONTAKEDOWN,
  SubjectBasicView,
} from '../lexicon/types/tools/ozone/history/defs'
import { getStatusIdentifierFromSubject } from '../mod-service/status'
import { ModerationEventRow } from '../mod-service/types'
import { AtUri } from '@atproto/syntax'
import { ModerationSubjectStatus } from '../db/schema/moderation_subject_status'
import {
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../lexicon/types/tools/ozone/moderation/defs'

const modEventsAssociatedWithPublicStatus = [
  'tools.ozone.moderation.defs#modEventAcknowledge',
  'tools.ozone.moderation.defs#modEventLabel',
  'tools.ozone.moderation.defs#modEventTakedown',
  'tools.ozone.moderation.defs#modEventReverseTakedown',
]

export type ModerationStatusHistoryCreator = (
  db: Database,
) => ModerationStatusHistory

export class ModerationStatusHistory {
  constructor(private db: Database) {}

  static creator() {
    return (db: Database) => new ModerationStatusHistory(db)
  }

  async createStatusForReporter(event: ModerationEventRow) {
    // only a few mod events can impact the public status
    if (event.action !== 'tools.ozone.moderation.defs#modEventReport') {
      return
    }

    const identifier = getStatusIdentifierFromSubject(
      event.subjectUri || event.subjectDid,
    )

    return this.db.db
      .insertInto('public_subject_status')
      .values({
        reporterDid: event.createdBy,
        did: identifier.did,
        recordPath: identifier.recordPath,
        createdAt: event.createdAt,
        modAction: MODACTIONPENDING,
        updatedAt: event.createdAt,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async adjustForModEvent(event: ModerationEventRow) {
    // Make sure we create a status row for the reporter first
    // If the event is not a report event, it won't create a row
    // if a status row already exists, it won't update/duplicate it
    await this.createStatusForReporter(event)

    // only a few mod events can update the public status
    if (!modEventsAssociatedWithPublicStatus.includes(event.action)) {
      return
    }

    const identifier = getStatusIdentifierFromSubject(
      event.subjectUri || event.subjectDid,
    )

    const updates: Partial<
      Pick<PublicSubjectStatus, 'modAction' | 'updatedAt'>
    > = {
      updatedAt: event.createdAt,
    }

    switch (event.action) {
      case 'tools.ozone.moderation.defs#modEventAcknowledge':
        updates.modAction = MODACTIONRESOLVE
        break
      case 'tools.ozone.moderation.defs#modEventLabel':
        updates.modAction = MODACTIONLABEL
        break
      case 'tools.ozone.moderation.defs#modEventTakedown':
        updates.modAction = event.durationInHours
          ? MODACTIONSUSPEND
          : MODACTIONTAKEDOWN
        break
    }

    // No updates necessary
    if (Object.keys(updates).length === 0) {
      return null
    }

    return (
      this.db.db
        .updateTable('public_subject_status')
        .where('did', '=', identifier.did)
        .where('createdAt', '<', event.createdAt)
        .if(!!identifier.recordPath, (query) =>
          query.where('recordPath', '=', identifier.recordPath),
        )
        // when mods acknowledge reports, there's a chance that they already labeled the content
        // or took a separate action on prior reports. in any case, we want to make sure that those statuses
        // are not overwritten because of acknowledging a report that happened after the previous action
        .if(updates.modAction === MODACTIONTAKEDOWN, (query) => {
          return query.where('modAction', '=', MODACTIONPENDING)
        })
        .set(updates)
        .executeTakeFirst()
    )
  }

  async getStatusesForReporter({
    reporterDid,
    limit = 50,
    cursor,
    sortDirection = 'desc',
  }: {
    reporterDid: string
    limit: number
    cursor?: string
    sortDirection: 'asc' | 'desc'
  }) {
    const { ref } = this.db.db.dynamic

    const builder = this.db.db
      .selectFrom('public_subject_status')
      .where('reporterDid', '=', reporterDid)
      .selectAll()

    const keyset = new TimeIdKeyset(
      ref(`public_subject_status.createdAt`),
      ref('public_subject_status.id'),
    )
    const paginatedBuilder = paginate(builder, {
      limit,
      cursor,
      keyset,
      direction: sortDirection,
    })

    const statuses = await paginatedBuilder.execute()
    return { statuses, cursor: keyset.packFromResult(statuses) }
  }

  async getStatusesForAccount({
    authorDid,
    limit = 50,
    cursor,
    sortDirection = 'desc',
  }: {
    authorDid: string
    limit: number
    cursor?: string
    sortDirection: 'asc' | 'desc'
  }) {
    const { ref } = this.db.db.dynamic

    const builder = this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', authorDid)
      .selectAll()

    const keyset = new TimeIdKeyset(
      ref(`moderation_subject_status.createdAt`),
      ref('moderation_subject_status.id'),
    )
    const paginatedBuilder = paginate(builder, {
      limit,
      cursor,
      keyset,
      direction: sortDirection,
    })

    const statuses = await paginatedBuilder.execute()
    return { statuses, cursor: keyset.packFromResult(statuses) }
  }

  atUriFromStatus(
    status: Pick<PublicSubjectStatus, 'did' | 'recordPath'>,
  ): string {
    return status.recordPath
      ? AtUri.make(status.did, ...status.recordPath.split('/')).toString()
      : status.did
  }

  basicViewFromPublicStatus(
    status: Selectable<PublicSubjectStatus>,
  ): SubjectBasicView {
    return {
      subject: this.atUriFromStatus(status),
      modAction: status.modAction,
      createdAt: status.createdAt,
      // @TODO: Do we need status?
      status: '',
    }
  }

  basicViewFromModerationStatus(
    status: Selectable<ModerationSubjectStatus>,
  ): SubjectBasicView | null {
    // Defaulting to resolve is not
    let modAction: SubjectBasicView['modAction'] | undefined

    if (status.takendown) {
      modAction =
        status.suspendUntil &&
        new Date(status.suspendUntil).getTime() > Date.now()
          ? MODACTIONSUSPEND
          : MODACTIONTAKEDOWN
    } else if (status.reviewState === REVIEWOPEN) {
      modAction = MODACTIONPENDING
    }

    if (!modAction) {
      return null
    }

    return {
      subject: this.atUriFromStatus(status),
      createdAt: status.createdAt,
      modAction,
      // @TODO: Do we need status?
      status: '',
    }
  }
}
