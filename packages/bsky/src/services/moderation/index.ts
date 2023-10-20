import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { PrimaryDatabase } from '../../db'
import { ModerationViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { ImageInvalidator } from '../../image/invalidator'
import {
  isModEventComment,
  isModEventLabel,
  isModEventReport,
  isModEventTakedown,
} from '../../lexicon/types/com/atproto/admin/defs'
import { addHoursToDate } from '../../util/date'
import {
  adjustModerationSubjectStatus,
  getStatusIdentifierFromSubject,
} from './status'
import {
  ModEventType,
  ModerationEventRow,
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRow,
  ReversibleModerationEvent,
  SubjectInfo,
} from './types'

type LabelerFunc = (
  labelParams: Pick<
    ModerationEventRow,
    | 'subjectCid'
    | 'subjectDid'
    | 'subjectUri'
    | 'createLabelVals'
    | 'negateLabelVals'
  >,
) => Promise<unknown>

export class ModerationService {
  constructor(
    public db: PrimaryDatabase,
    public imgUriBuilder: ImageUriBuilder,
    public imgInvalidator: ImageInvalidator,
  ) {}

  static creator(
    imgUriBuilder: ImageUriBuilder,
    imgInvalidator: ImageInvalidator,
  ) {
    return (db: PrimaryDatabase) =>
      new ModerationService(db, imgUriBuilder, imgInvalidator)
  }

  views = new ModerationViews(this.db)

  async getEvent(id: number): Promise<ModerationEventRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_event')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async getEventOrThrow(id: number): Promise<ModerationEventRow> {
    const event = await this.getEvent(id)
    if (!event) throw new InvalidRequestError('Moderation event not found')
    return event
  }

  async getEvents(opts: {
    subject?: string
    limit: number
    cursor?: string
    sortDirection?: 'asc' | 'desc'
  }): Promise<ModerationEventRowWithHandle[]> {
    const { subject, limit, cursor, sortDirection = 'desc' } = opts
    let builder = this.db.db
      .selectFrom('moderation_event')
      .leftJoin(
        'actor as creatorActor',
        'creatorActor.did',
        'moderation_event.createdBy',
      )
      .leftJoin(
        'actor as subjectActor',
        'subjectActor.did',
        'moderation_event.subjectDid',
      )
    if (subject) {
      builder = builder.where((qb) => {
        return qb
          .where((subQb) =>
            subQb
              .where('subjectDid', '=', subject)
              .where('subjectUri', 'is', null),
          )
          .orWhere('subjectUri', '=', subject)
      })
    }
    if (cursor) {
      const cursorNumeric = parseInt(cursor, 10)
      if (isNaN(cursorNumeric)) {
        throw new InvalidRequestError('Malformed cursor')
      }
      builder = builder.where(
        'id',
        sortDirection === 'asc' ? '>' : '<',
        cursorNumeric,
      )
    }
    return await builder
      .selectAll(['moderation_event'])
      .select([
        'subjectActor.handle as subjectHandle',
        'creatorActor.handle as creatorHandle',
      ])
      .orderBy('id', sortDirection)
      .limit(limit)
      .execute()
  }

  async getReport(id: number): Promise<ModerationEventRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_event')
      .where('action', '=', 'com.atproto.admin.defs#modEventReport')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async getCurrentStatus(
    subject: { did: string } | { uri: AtUri } | { cids: CID[] },
  ) {
    let builder = this.db.db.selectFrom('moderation_subject_status').selectAll()
    if ('did' in subject) {
      builder = builder.where('did', '=', subject.did)
    } else if ('uri' in subject) {
      builder = builder.where('recordPath', '=', subject.uri.toString())
    }
    // TODO: Handle the cid status
    return await builder.execute()
  }

  buildSubjectInfo(
    subject: { did: string } | { uri: AtUri; cid: CID },
    subjectBlobCids?: CID[],
  ): SubjectInfo {
    if ('did' in subject) {
      if (subjectBlobCids?.length) {
        throw new InvalidRequestError('Blobs do not apply to repo subjects')
      }
      // Allowing dids that may not exist: may have been deleted but needs to remain actionable.
      return {
        subjectType: 'com.atproto.admin.defs#repoRef',
        subjectDid: subject.did,
        subjectUri: null,
        subjectCid: null,
      }
    }

    // Allowing records/blobs that may not exist: may have been deleted but needs to remain actionable.
    return {
      subjectType: 'com.atproto.repo.strongRef',
      subjectDid: subject.uri.host,
      subjectUri: subject.uri.toString(),
      subjectCid: subject.cid.toString(),
    }
  }

  async logEvent(info: {
    event: ModEventType
    subject: { did: string } | { uri: AtUri; cid: CID }
    subjectBlobCids?: CID[]
    createdBy: string
    createdAt?: Date
  }): Promise<ModerationEventRow> {
    this.db.assertTransaction()
    const {
      event,
      createdBy,
      subject,
      subjectBlobCids,
      createdAt = new Date(),
    } = info

    // Resolve subject info
    const subjectInfo = this.buildSubjectInfo(subject, subjectBlobCids)

    const createLabelVals =
      isModEventLabel(event) && event.createLabelVals.length > 0
        ? event.createLabelVals.join(' ')
        : undefined
    const negateLabelVals =
      isModEventLabel(event) && event.negateLabelVals.length > 0
        ? event.negateLabelVals.join(' ')
        : undefined

    const meta: Record<string, string> = {}

    if (isModEventReport(event)) {
      meta.reportType = event.reportType
    }

    const actionResult = await this.db.db
      .insertInto('moderation_event')
      .values({
        // TODO: WHYYY?
        // @ts-ignore
        action: event.$type,
        comment: event.comment,
        createdAt: createdAt.toISOString(),
        createdBy,
        createLabelVals,
        negateLabelVals,
        durationInHours: event.durationInHours,
        refEventId: event.refEventId,
        meta,
        expiresAt:
          isModEventTakedown(event) && event.durationInHours
            ? addHoursToDate(event.durationInHours, createdAt).toISOString()
            : undefined,
        ...subjectInfo,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await adjustModerationSubjectStatus(this.db, actionResult, subjectBlobCids)

    return actionResult
  }

  async getActionsDueForReversal(): Promise<ModerationEventRow[]> {
    const actionsDueForReversal = await this.db.db
      .selectFrom('moderation_event')
      .where('durationInHours', 'is not', null)
      .where('expiresAt', '<', new Date().toISOString())
      .selectAll()
      .execute()

    return actionsDueForReversal
  }

  // TODO: This isn't ideal. inside .logEvent() we fetch the refEventId but the event itself
  // is already being fetched before calling `revertAction`
  async revertAction(
    { createdBy, createdAt, comment, subject }: ReversibleModerationEvent,
    applyLabels: LabelerFunc,
  ) {
    this.db.assertTransaction()
    const result = await this.logEvent({
      event: {
        $type: 'com.atproto.admin.defs#modEventReverseTakedown',
        comment,
      },
      createdAt,
      createdBy,
      subject,
    })

    if (
      result.subjectType === 'com.atproto.admin.defs#repoRef' &&
      result.subjectDid
    ) {
      await this.reverseTakedownRepo({
        did: result.subjectDid,
      })
    }

    if (
      result.subjectType === 'com.atproto.repo.strongRef' &&
      result.subjectUri
    ) {
      await this.reverseTakedownRecord({
        uri: new AtUri(result.subjectUri),
      })
    }

    return result
  }

  async takedownRepo(info: { takedownId: number; did: string }) {
    await this.db.db
      .updateTable('actor')
      .set({ takedownId: info.takedownId })
      .where('did', '=', info.did)
      .where('takedownId', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownRepo(info: { did: string }) {
    await this.db.db
      .updateTable('actor')
      .set({ takedownId: null })
      .where('did', '=', info.did)
      .execute()
  }

  async takedownRecord(info: {
    takedownId: number
    uri: AtUri
    blobCids?: CID[]
  }) {
    this.db.assertTransaction()
    await this.db.db
      .updateTable('record')
      .set({ takedownId: info.takedownId })
      .where('uri', '=', info.uri.toString())
      .where('takedownId', 'is', null)
      .executeTakeFirst()
    if (info.blobCids) {
      await Promise.all(
        info.blobCids.map(async (cid) => {
          const paths = ImageUriBuilder.presets.map((id) => {
            const uri = this.imgUriBuilder.getPresetUri(id, info.uri.host, cid)
            return uri.replace(this.imgUriBuilder.endpoint, '')
          })
          await this.imgInvalidator.invalidate(cid.toString(), paths)
        }),
      )
    }
  }

  async reverseTakedownRecord(info: { uri: AtUri }) {
    this.db.assertTransaction()
    await this.db.db
      .updateTable('record')
      .set({ takedownId: null })
      .where('uri', '=', info.uri.toString())
      .execute()
  }

  async report(info: {
    reasonType: NonNullable<ModerationEventRow['meta']>['reportType']
    reason?: string
    subject: { did: string } | { uri: AtUri; cid: CID }
    reportedBy: string
    createdAt?: Date
  }): Promise<ModerationEventRow> {
    const {
      reasonType,
      reason,
      reportedBy,
      createdAt = new Date(),
      subject,
    } = info

    const event = await this.logEvent({
      event: {
        $type: 'com.atproto.admin.defs#modEventReport',
        reportType: reasonType,
        comment: reason || null,
      },
      createdBy: reportedBy,
      subject,
      createdAt,
    })

    return event
  }

  async getSubjectStatuses({
    cursor,
    limit = 50,
    reviewState,
    reviewedAfter,
    reviewedBefore,
    reportedAfter,
    reportedBefore,
    includeMuted,
    ignoreSubjects,
    sortDirection,
    lastReviewedBy,
    sortField,
    subject,
  }: {
    cursor?: string
    limit?: number
    reviewedBefore?: string
    reviewState?: ModerationSubjectStatusRow['reviewState']
    reviewedAfter?: string
    reportedAfter?: string
    reportedBefore?: string
    includeMuted?: boolean
    subject?: string
    ignoreSubjects?: string[]
    sortDirection: 'asc' | 'desc'
    lastReviewedBy?: string
    sortField: 'lastReviewedAt' | 'lastReportedAt'
  }) {
    let builder = this.db.db
      .selectFrom('moderation_subject_status')
      .leftJoin('actor', 'actor.did', 'moderation_subject_status.did')

    if (subject) {
      const subjectInfo = getStatusIdentifierFromSubject(subject)
      builder = builder
        .where('moderation_subject_status.did', '=', subjectInfo.did)
        .where((qb) =>
          subjectInfo.recordPath
            ? qb.where('recordPath', '=', subjectInfo.recordPath)
            : qb.where('recordPath', '=', ''),
        )
    }

    if (ignoreSubjects?.length) {
      builder = builder
        .where('moderation_subject_status.did', 'not in', ignoreSubjects)
        .where('recordPath', 'not in', ignoreSubjects)
    }

    if (reviewState) {
      builder = builder.where('reviewState', '=', reviewState)
    }

    if (lastReviewedBy) {
      builder = builder.where('lastReviewedBy', '=', lastReviewedBy)
    }

    if (reviewedAfter) {
      builder = builder.where('lastReviewedAt', '>', reviewedAfter)
    }

    if (reviewedBefore) {
      builder = builder.where('lastReviewedAt', '<', reviewedBefore)
    }

    if (reportedAfter) {
      builder = builder.where('lastReviewedAt', '>', reportedAfter)
    }

    if (reportedBefore) {
      builder = builder.where('lastReportedAt', '<', reportedBefore)
    }

    if (!includeMuted) {
      builder = builder.where((qb) =>
        qb
          .where('muteUntil', '<', new Date().toISOString())
          .orWhere('muteUntil', 'is', null),
      )
    }

    builder = builder.orderBy(sortField, sortDirection)

    if (cursor) {
      const cursorNumeric = parseInt(cursor, 10)
      if (isNaN(cursorNumeric)) {
        throw new InvalidRequestError('Malformed cursor')
      }
      builder = builder.where('id', '<', cursorNumeric)
    }

    const results = await builder
      .limit(limit)
      .select('actor.handle as handle')
      .selectAll('moderation_subject_status')
      .execute()
    return results
  }

  async isSubjectTakendown(
    subject: { did: string } | { uri: AtUri },
  ): Promise<boolean> {
    const { did, recordPath } = getStatusIdentifierFromSubject(
      'did' in subject ? subject.did : subject.uri,
    )
    let builder = this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', recordPath || '')

    const result = await builder.select('takendown').executeTakeFirst()

    return !!result?.takendown
  }
}
