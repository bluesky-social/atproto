import { Selectable } from 'kysely'
import Database from '../db'
import { paginate, TimeIdKeyset } from '../db/pagination'
import { PublicSubjectStatus } from '../db/schema/public_subject_status'
import {
  EventView,
  MODACTIONLABEL,
  MODACTIONPENDING,
  MODACTIONRESOLVE,
  MODACTIONSUSPEND,
  MODACTIONTAKEDOWN,
} from '../lexicon/types/tools/ozone/history/defs'
import * as ToolsOzoneModerationDefs from '../lexicon/types/tools/ozone/moderation/defs'
import { getStatusIdentifierFromSubject } from '../mod-service/status'
import { ModerationEventRow } from '../mod-service/types'
import { AtUri } from '@atproto/syntax'
import { ModerationEvent } from '../db/schema/moderation_event'

const modEventsAssociatedWithPublicStatus = [
  'tools.ozone.moderation.defs#modEventAcknowledge',
  'tools.ozone.moderation.defs#modEventLabel',
  'tools.ozone.moderation.defs#modEventTakedown',
  'tools.ozone.moderation.defs#modEventReverseTakedown',
]

export const publishableModEvents = [
  'tools.ozone.moderation.defs#modEventReport',
  'tools.ozone.moderation.defs#modEventLabel',
  'tools.ozone.moderation.defs#modEventAcknowledge',
  'tools.ozone.moderation.defs#modEventEmail',
  'tools.ozone.moderation.defs#modEventTakedown',
] as ModerationEvent['action'][]

export type ModerationStatusHistoryCreator = (
  db: Database,
) => ModerationStatusHistory

export class ModerationStatusHistory {
  constructor(private db: Database) {}

  static creator() {
    return (db: Database) => new ModerationStatusHistory(db)
  }

  async createStatus(event: ModerationEventRow) {
    const identifier = getStatusIdentifierFromSubject(
      event.subjectUri || event.subjectDid,
    )

    const defaultValues = {
      did: identifier.did,
      recordPath: identifier.recordPath,
      createdAt: event.createdAt,
      updatedAt: event.createdAt,
    }

    const rows = [
      {
        ...defaultValues,
        modAction: MODACTIONPENDING as PublicSubjectStatus['modAction'],
        viewerDid: event.createdBy,
        isAuthor: false,
      },
      {
        ...defaultValues,
        modAction: MODACTIONPENDING as PublicSubjectStatus['modAction'],
        viewerDid: event.subjectDid,
        isAuthor: true,
      },
    ]

    return this.db.db
      .insertInto('public_subject_status')
      .values(rows)
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async adjustForModEvent(event: ModerationEventRow) {
    // Make sure we create a status row for the reporter first
    // If the event is not a report event, it won't create a row
    // if a status row already exists, it won't update/duplicate it
    await this.createStatus(event)

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
        .if(updates.modAction === MODACTIONRESOLVE, (query) => {
          return query.where('modAction', '=', MODACTIONPENDING)
        })
        .set(updates)
        .executeTakeFirst()
    )
  }

  async getStatuses({
    viewerDid,
    limit = 50,
    cursor,
    forAuthor = false,
    sortDirection = 'desc',
  }: {
    viewerDid: string
    limit: number
    forAuthor?: boolean
    cursor?: string
    sortDirection: 'asc' | 'desc'
  }) {
    const { ref } = this.db.db.dynamic

    const builder = this.db.db
      .selectFrom('public_subject_status')
      .where('viewerDid', '=', viewerDid)
      .where('isAuthor', '=', forAuthor)
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

  basicView(status: Selectable<PublicSubjectStatus>) {
    return {
      subject: this.atUriFromStatus(status),
      modAction: status.modAction,
      createdAt: status.createdAt,
    }
  }

  transformModEventToPublicEvent(
    event: ModerationEventRow,
  ): EventView['event'] | null {
    // @TODO: we're ignoring comments here because as of now, ozone doesn't allow
    // mods to opt in to make a comment public vs. private and we don't want to publish
    // all action comments so the safer option is to ignore those for now
    if ('tools.ozone.moderation.defs#modEventAcknowledge' === event.action) {
      return {
        $type: 'tools.ozone.history.defs#eventResolve',
      }
    }

    if ('tools.ozone.moderation.defs#modEventReport' === event.action) {
      return {
        $type: 'tools.ozone.history.defs#eventReport',
        reportType: event.meta?.['reportType'],
      }
    }
    if ('tools.ozone.moderation.defs#modEventEmail' === event.action) {
      return {
        $type: 'tools.ozone.history.defs#eventEmail',
        subjectLine: event.meta?.['subjectLine'],
      }
    }

    if ('tools.ozone.moderation.defs#modEventLabel' === event.action) {
      return {
        $type: 'tools.ozone.history.defs#eventLabel',
        createLabelVals: event.createLabelVals
          ? event.createLabelVals.split(',')
          : [],
        negateLabelVals: event.negateLabelVals
          ? event.negateLabelVals.split(',')
          : [],
      }
    }

    if ('tools.ozone.moderation.defs#modEventTakedown' === event.action) {
      return {
        $type: 'tools.ozone.history.defs#eventTakedown',
        durationInHours: event.durationInHours,
      }
    }

    return null
  }

  eventView(modEvent: ModerationEventRow): EventView | null {
    if (!publishableModEvents.includes(modEvent.action)) return null
    const event = this.transformModEventToPublicEvent(modEvent)
    if (!event) return null

    return {
      event,
      createdAt: modEvent.createdAt,
      subject: modEvent.subjectUri || modEvent.subjectDid,
    }
  }
}
