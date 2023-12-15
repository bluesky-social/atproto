import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../../db'
import { ModerationViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { Main as StrongRef } from '../../lexicon/types/com/atproto/repo/strongRef'
import { ImageInvalidator } from '../../image/invalidator'
import {
  isModEventComment,
  isModEventLabel,
  isModEventMute,
  isModEventReport,
  isModEventTakedown,
  isModEventEmail,
  RepoRef,
  RepoBlobRef,
} from '../../lexicon/types/com/atproto/admin/defs'
import { addHoursToDate } from '../../util/date'
import {
  adjustModerationSubjectStatus,
  getStatusIdentifierFromSubject,
} from './status'
import {
  ModEventType,
  ModerationEventRow,
  ModerationSubjectStatusRow,
  ReversibleModerationEvent,
  SubjectInfo,
} from './types'
import { ModerationEvent } from '../../db/schema/moderation_event'
import { paginate } from '../../db/pagination'
import { StatusKeyset, TimeIdKeyset } from './pagination'
import AtpAgent from '@atproto/api'

export class ModerationService {
  constructor(
    public db: Database,
    public appviewAgent: AtpAgent,
    public imgUriBuilder: ImageUriBuilder,
    public imgInvalidator: ImageInvalidator,
  ) {}

  static creator(
    appviewAgent: AtpAgent,
    imgUriBuilder: ImageUriBuilder,
    imgInvalidator: ImageInvalidator,
  ) {
    return (db: Database) =>
      new ModerationService(db, appviewAgent, imgUriBuilder, imgInvalidator)
  }

  views = new ModerationViews(this.db, this.appviewAgent)

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
    createdBy?: string
    limit: number
    cursor?: string
    includeAllUserRecords: boolean
    types: ModerationEvent['action'][]
    sortDirection?: 'asc' | 'desc'
  }): Promise<{ cursor?: string; events: ModerationEventRow[] }> {
    const {
      subject,
      createdBy,
      limit,
      cursor,
      includeAllUserRecords,
      sortDirection = 'desc',
      types,
    } = opts
    let builder = this.db.db.selectFrom('moderation_event').selectAll()
    if (subject) {
      builder = builder.where((qb) => {
        if (includeAllUserRecords) {
          // If subject is an at-uri, we need to extract the DID from the at-uri
          // otherwise, subject is probably a DID already
          if (subject.startsWith('at://')) {
            const uri = new AtUri(subject)
            return qb.where('subjectDid', '=', uri.hostname)
          }
          return qb.where('subjectDid', '=', subject)
        }
        return qb
          .where((subQb) =>
            subQb
              .where('subjectDid', '=', subject)
              .where('subjectUri', 'is', null),
          )
          .orWhere('subjectUri', '=', subject)
      })
    }
    if (types.length) {
      builder = builder.where((qb) => {
        if (types.length === 1) {
          return qb.where('action', '=', types[0])
        }

        return qb.where('action', 'in', types)
      })
    }
    if (createdBy) {
      builder = builder.where('createdBy', '=', createdBy)
    }

    const { ref } = this.db.db.dynamic
    const keyset = new TimeIdKeyset(
      ref(`moderation_event.createdAt`),
      ref('moderation_event.id'),
    )
    const paginatedBuilder = paginate(builder, {
      limit,
      cursor,
      keyset,
      direction: sortDirection,
      tryIndex: true,
    })

    const result = await paginatedBuilder.execute()

    return { cursor: keyset.packFromResult(result), events: result }
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

    const meta: Record<string, string | boolean> = {}

    if (isModEventReport(event)) {
      meta.reportType = event.reportType
    }

    if (isModEventComment(event) && event.sticky) {
      meta.sticky = event.sticky
    }

    if (isModEventEmail(event)) {
      meta.subjectLine = event.subjectLine
    }

    const modEvent = await this.db.db
      .insertInto('moderation_event')
      .values({
        comment: event.comment ? `${event.comment}` : null,
        action: event.$type as ModerationEvent['action'],
        createdAt: createdAt.toISOString(),
        createdBy,
        createLabelVals,
        negateLabelVals,
        durationInHours: event.durationInHours
          ? Number(event.durationInHours)
          : null,
        meta,
        expiresAt:
          (isModEventTakedown(event) || isModEventMute(event)) &&
          event.durationInHours
            ? addHoursToDate(event.durationInHours, createdAt).toISOString()
            : undefined,
        ...subjectInfo,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await adjustModerationSubjectStatus(this.db, modEvent, subjectBlobCids)

    return modEvent
  }

  async getLastReversibleEventForSubject({
    did,
    muteUntil,
    recordPath,
    suspendUntil,
  }: ModerationSubjectStatusRow) {
    const isSuspended = suspendUntil && new Date(suspendUntil) < new Date()
    const isMuted = muteUntil && new Date(muteUntil) < new Date()

    // If the subject is neither suspended nor muted don't bother finding the last reversible event
    // Ideally, this should never happen because the caller of this method should only call this
    // after ensuring that the suspended or muted subjects are being reversed
    if (!isSuspended && !isMuted) {
      return null
    }

    let builder = this.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', did)

    if (recordPath) {
      builder = builder.where('subjectUri', 'like', `%${recordPath}%`)
    }

    // Means the subject was suspended and needs to be unsuspended
    if (isSuspended) {
      builder = builder
        .where('action', '=', 'com.atproto.admin.defs#modEventTakedown')
        .where('durationInHours', 'is not', null)
    }
    if (isMuted) {
      builder = builder
        .where('action', '=', 'com.atproto.admin.defs#modEventMute')
        .where('durationInHours', 'is not', null)
    }

    return await builder
      .orderBy('id', 'desc')
      .selectAll()
      .limit(1)
      .executeTakeFirst()
  }

  async getSubjectsDueForReversal(): Promise<ModerationSubjectStatusRow[]> {
    const subjectsDueForReversal = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('suspendUntil', '<', new Date().toISOString())
      .orWhere('muteUntil', '<', new Date().toISOString())
      .selectAll()
      .execute()

    return subjectsDueForReversal
  }

  async isSubjectSuspended(did: string): Promise<boolean> {
    const res = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('suspendUntil', '>', new Date().toISOString())
      .select('did')
      .limit(1)
      .executeTakeFirst()
    return !!res
  }

  async revertState({
    createdBy,
    createdAt,
    comment,
    action,
    subject,
  }: ReversibleModerationEvent): Promise<{
    result: ModerationEventRow
    restored?: TakedownSubjects
  }> {
    const isRevertingTakedown =
      action === 'com.atproto.admin.defs#modEventTakedown'
    this.db.assertTransaction()
    const result = await this.logEvent({
      event: {
        $type: isRevertingTakedown
          ? 'com.atproto.admin.defs#modEventReverseTakedown'
          : 'com.atproto.admin.defs#modEventUnmute',
        comment: comment ?? undefined,
      },
      createdAt,
      createdBy,
      subject,
    })

    let restored: TakedownSubjects | undefined

    if (!isRevertingTakedown) {
      return { result, restored }
    }

    if (
      result.subjectType === 'com.atproto.admin.defs#repoRef' &&
      result.subjectDid
    ) {
      await this.reverseTakedownRepo({
        did: result.subjectDid,
      })
      restored = {
        did: result.subjectDid,
        subjects: [
          {
            $type: 'com.atproto.admin.defs#repoRef',
            did: result.subjectDid,
          },
        ],
      }
    }

    if (
      result.subjectType === 'com.atproto.repo.strongRef' &&
      result.subjectUri
    ) {
      const uri = new AtUri(result.subjectUri)
      await this.reverseTakedownRecord({
        uri,
      })
      const did = uri.hostname
      // TODO: MOD_EVENT This bit needs testing
      const subjectStatus = await this.db.db
        .selectFrom('moderation_subject_status')
        .where('did', '=', uri.host)
        .where('recordPath', '=', `${uri.collection}/${uri.rkey}`)
        .select('blobCids')
        .executeTakeFirst()
      const blobCids = subjectStatus?.blobCids || []
      restored = {
        did,
        subjects: [
          {
            $type: 'com.atproto.repo.strongRef',
            uri: result.subjectUri,
            cid: result.subjectCid ?? '',
          },
          ...blobCids.map((cid) => ({
            $type: 'com.atproto.admin.defs#repoBlobRef',
            did,
            cid,
            recordUri: result.subjectUri,
          })),
        ],
      }
    }

    return { result, restored }
  }

  async takedownRepo(info: {
    takedownId: number
    did: string
  }): Promise<TakedownSubjects> {
    const { takedownId, did } = info
    await this.db.db
      .insertInto('push_event')
      .values({
        eventType: 'repo_takedown',
        subjectDid: did,
        takedownId,
      })
      .onConflict((oc) =>
        oc
          .columns(['eventType', 'subjectDid'])
          .doUpdateSet({ confirmedAt: null, takedownId }),
      )
      .execute()

    return {
      did,
      subjects: [
        {
          $type: 'com.atproto.admin.defs#repoRef',
          did,
        },
      ],
    }
  }

  async reverseTakedownRepo(info: { did: string }) {
    await this.db.db
      .updateTable('push_event')
      .where('eventType', '=', 'repo_takedown')
      .where('subjectDid', '=', info.did)
      .set({ takedownId: null, confirmedAt: null })
      .execute()
  }

  async takedownRecord(info: {
    takedownId: number
    uri: AtUri
    cid: CID
  }): Promise<TakedownSubjects> {
    const { takedownId, uri, cid } = info
    const did = uri.hostname
    this.db.assertTransaction()
    await this.db.db
      .insertInto('push_event')
      .values({
        eventType: 'record_takedown',
        subjectDid: uri.hostname,
        subjectUri: uri.toString(),
        subjectCid: cid.toString(),
        takedownId,
      })
      .onConflict((oc) =>
        oc
          .columns(['eventType', 'subjectDid', 'subjectUri'])
          .doUpdateSet({ confirmedAt: null, takedownId }),
      )
      .execute()
    return {
      did,
      subjects: [
        {
          $type: 'com.atproto.repo.strongRef',
          uri: uri.toString(),
          cid: cid.toString(),
        },
      ],
    }
  }

  async reverseTakedownRecord(info: { uri: AtUri }) {
    this.db.assertTransaction()
    await this.db.db
      .updateTable('push_event')
      .where('eventType', '=', 'record_takedown')
      .where('subjectDid', '=', info.uri.hostname)
      .where('subjectUri', '=', info.uri.toString())
      .set({ takedownId: null, confirmedAt: null })
      .execute()
  }

  async takedownBlobs(info: {
    takedownId: number
    did: string
    blobCids: CID[]
  }): Promise<TakedownSubjects> {
    const { takedownId, did, blobCids } = info
    this.db.assertTransaction()

    if (blobCids.length > 0) {
      await this.db.db
        .insertInto('push_event')
        .values(
          blobCids.map((cid) => ({
            eventType: 'blob_takedown' as const,
            subjectDid: did,
            subjectBlobCid: cid.toString(),
            takedownId,
          })),
        )
        .onConflict((oc) =>
          oc
            .columns(['eventType', 'subjectDid', 'subjectBlobCid'])
            .doUpdateSet({ confirmedAt: null, takedownId }),
        )
        .execute()
    }
    return {
      did,
      subjects: blobCids.map((cid) => ({
        $type: 'com.atproto.admin.defs#repoBlobRef',
        did,
        cid: cid.toString(),
      })),
    }
  }

  async reverseTakedownBlobs(info: { did: string; blobCids: CID[] }) {
    this.db.assertTransaction()
    const { did, blobCids } = info
    if (blobCids.length < 1) return
    await this.db.db
      .updateTable('push_event')
      .where('eventType', '=', 'blob_takedown')
      .where('subjectDid', '=', did)
      .where(
        'subjectBlobCid',
        'in',
        blobCids.map((c) => c.toString()),
      )
      .set({ takedownId: null, confirmedAt: null })
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
        comment: reason,
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
    takendown,
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
    takendown?: boolean
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
    let builder = this.db.db.selectFrom('moderation_subject_status').selectAll()

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

    if (takendown) {
      builder = builder.where('takendown', '=', true)
    }

    if (!includeMuted) {
      builder = builder.where((qb) =>
        qb
          .where('muteUntil', '<', new Date().toISOString())
          .orWhere('muteUntil', 'is', null),
      )
    }

    const { ref } = this.db.db.dynamic
    const keyset = new StatusKeyset(
      ref(`moderation_subject_status.${sortField}`),
      ref('moderation_subject_status.id'),
    )
    const paginatedBuilder = paginate(builder, {
      limit,
      cursor,
      keyset,
      direction: sortDirection,
      tryIndex: true,
      nullsLast: true,
    })

    const results = await paginatedBuilder.execute()

    return { statuses: results, cursor: keyset.packFromResult(results) }
  }

  async isSubjectTakendown(
    subject: { did: string } | { uri: AtUri },
  ): Promise<boolean> {
    const { did, recordPath } = getStatusIdentifierFromSubject(
      'did' in subject ? subject.did : subject.uri,
    )
    const builder = this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', recordPath || '')

    const result = await builder.select('takendown').executeTakeFirst()

    return !!result?.takendown
  }
}

export type TakedownSubjects = {
  did: string
  subjects: (RepoRef | RepoBlobRef | StrongRef)[]
}
