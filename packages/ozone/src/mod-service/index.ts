import { CID } from 'multiformats/cid'
import { AtUri, INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { addHoursToDate } from '@atproto/common'
import { Database } from '../db'
import { AppviewAuth, ModerationViews } from './views'
import { Main as StrongRef } from '../lexicon/types/com/atproto/repo/strongRef'
import {
  isModEventComment,
  isModEventLabel,
  isModEventMute,
  isModEventReport,
  isModEventTakedown,
  isModEventEmail,
  isModEventTag,
  RepoRef,
  RepoBlobRef,
} from '../lexicon/types/com/atproto/admin/defs'
import {
  adjustModerationSubjectStatus,
  getStatusIdentifierFromSubject,
} from './status'
import {
  ModEventType,
  ModerationEventRow,
  ModerationSubjectStatusRow,
  ReversibleModerationEvent,
  UNSPECCED_TAKEDOWN_BLOBS_LABEL,
  UNSPECCED_TAKEDOWN_LABEL,
} from './types'
import { ModerationEvent } from '../db/schema/moderation_event'
import { StatusKeyset, TimeIdKeyset, paginate } from '../db/pagination'
import AtpAgent from '@atproto/api'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { Insertable, sql } from 'kysely'
import {
  ModSubject,
  RecordSubject,
  RepoSubject,
  subjectFromStatusRow,
} from './subject'
import { jsonb } from '../db/types'
import { LabelChannel } from '../db/schema/label'
import { BlobPushEvent } from '../db/schema/blob_push_event'
import { BackgroundQueue } from '../background'
import { EventPusher } from '../daemon'
import { ImageInvalidator } from '../image-invalidator'
import { httpLogger as log } from '../logger'

export type ModerationServiceCreator = (db: Database) => ModerationService

export class ModerationService {
  constructor(
    public db: Database,
    public backgroundQueue: BackgroundQueue,
    public eventPusher: EventPusher,
    public appviewAgent: AtpAgent,
    private appviewAuth: AppviewAuth,
    public serverDid: string,
    public imgInvalidator?: ImageInvalidator,
    public cdnPaths?: string[],
  ) {}

  static creator(
    backgroundQueue: BackgroundQueue,
    eventPusher: EventPusher,
    appviewAgent: AtpAgent,
    appviewAuth: AppviewAuth,
    serverDid: string,
    imgInvalidator?: ImageInvalidator,
    cdnPaths?: string[],
  ) {
    return (db: Database) =>
      new ModerationService(
        db,
        backgroundQueue,
        eventPusher,
        appviewAgent,
        appviewAuth,
        serverDid,
        imgInvalidator,
        cdnPaths,
      )
  }

  views = new ModerationViews(this.db, this.appviewAgent, this.appviewAuth)

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
    hasComment?: boolean
    comment?: string
    createdAfter?: string
    createdBefore?: string
    addedLabels: string[]
    removedLabels: string[]
    addedTags: string[]
    removedTags: string[]
    reportTypes?: string[]
  }): Promise<{ cursor?: string; events: ModerationEventRow[] }> {
    const {
      subject,
      createdBy,
      limit,
      cursor,
      includeAllUserRecords,
      sortDirection = 'desc',
      types,
      hasComment,
      comment,
      createdAfter,
      createdBefore,
      addedLabels,
      removedLabels,
      addedTags,
      removedTags,
      reportTypes,
    } = opts
    const { ref } = this.db.db.dynamic
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
    if (createdAfter) {
      builder = builder.where('createdAt', '>=', createdAfter)
    }
    if (createdBefore) {
      builder = builder.where('createdAt', '<=', createdBefore)
    }
    if (comment) {
      builder = builder.where('comment', 'ilike', `%${comment}%`)
    }
    if (hasComment) {
      builder = builder.where('comment', 'is not', null)
    }

    // If multiple labels are passed, then only retrieve events where all those labels exist
    if (addedLabels.length) {
      addedLabels.forEach((label) => {
        builder = builder.where('createLabelVals', 'ilike', `%${label}%`)
      })
    }
    if (removedLabels.length) {
      removedLabels.forEach((label) => {
        builder = builder.where('negateLabelVals', 'ilike', `%${label}%`)
      })
    }
    if (addedTags.length) {
      builder = builder.where(sql`${ref('addedTags')} @> ${jsonb(addedTags)}`)
    }
    if (removedTags.length) {
      builder = builder.where(
        sql`${ref('removedTags')} @> ${jsonb(removedTags)}`,
      )
    }
    if (reportTypes?.length) {
      builder = builder.where(sql`meta->>'reportType'`, 'in', reportTypes)
    }

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

    const infos = await this.views.getAccoutInfosByDid([
      ...result.map((row) => row.subjectDid),
      ...result.map((row) => row.createdBy),
    ])

    const resultWithHandles = result.map((r) => ({
      ...r,
      creatorHandle: infos.get(r.createdBy)?.handle,
      subjectHandle: infos.get(r.subjectDid)?.handle,
    }))

    return { cursor: keyset.packFromResult(result), events: resultWithHandles }
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

  async logEvent(info: {
    event: ModEventType
    subject: ModSubject
    createdBy: string
    createdAt?: Date
  }): Promise<{
    event: ModerationEventRow
    subjectStatus: ModerationSubjectStatusRow | null
  }> {
    this.db.assertTransaction()
    const { event, subject, createdBy, createdAt = new Date() } = info

    const createLabelVals =
      isModEventLabel(event) && event.createLabelVals.length > 0
        ? event.createLabelVals.join(' ')
        : undefined
    const negateLabelVals =
      isModEventLabel(event) && event.negateLabelVals.length > 0
        ? event.negateLabelVals.join(' ')
        : undefined

    const meta: Record<string, string | boolean> = {}

    const addedTags = isModEventTag(event) ? jsonb(event.add) : null
    const removedTags = isModEventTag(event) ? jsonb(event.remove) : null

    if (isModEventReport(event)) {
      meta.reportType = event.reportType
    }

    if (isModEventComment(event) && event.sticky) {
      meta.sticky = event.sticky
    }

    if (isModEventEmail(event)) {
      meta.subjectLine = event.subjectLine
    }

    const subjectInfo = subject.info()

    const modEvent = await this.db.db
      .insertInto('moderation_event')
      .values({
        comment: event.comment ? `${event.comment}` : null,
        action: event.$type as ModerationEvent['action'],
        createdAt: createdAt.toISOString(),
        createdBy,
        createLabelVals,
        negateLabelVals,
        addedTags,
        removedTags,
        durationInHours: event.durationInHours
          ? Number(event.durationInHours)
          : null,
        meta,
        expiresAt:
          (isModEventTakedown(event) || isModEventMute(event)) &&
          event.durationInHours
            ? addHoursToDate(event.durationInHours, createdAt).toISOString()
            : undefined,
        subjectType: subjectInfo.subjectType,
        subjectDid: subjectInfo.subjectDid,
        subjectUri: subjectInfo.subjectUri,
        subjectCid: subjectInfo.subjectCid,
        subjectBlobCids: jsonb(subjectInfo.subjectBlobCids),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const subjectStatus = await adjustModerationSubjectStatus(
      this.db,
      modEvent,
      subject.blobCids,
    )

    return { event: modEvent, subjectStatus }
  }

  async getLastReversibleEventForSubject(subject: ReversalSubject) {
    // If the subject is neither suspended nor muted don't bother finding the last reversible event
    // Ideally, this should never happen because the caller of this method should only call this
    // after ensuring that the suspended or muted subjects are being reversed
    if (!subject.reverseMute && !subject.reverseSuspend) {
      return null
    }

    let builder = this.db.db
      .selectFrom('moderation_event')
      .where('subjectDid', '=', subject.subject.did)

    if (subject.subject.recordPath) {
      builder = builder.where(
        'subjectUri',
        'like',
        `%${subject.subject.recordPath}%`,
      )
    }

    // Means the subject was suspended and needs to be unsuspended
    if (subject.reverseSuspend) {
      builder = builder
        .where('action', '=', 'com.atproto.admin.defs#modEventTakedown')
        .where('durationInHours', 'is not', null)
    }
    if (subject.reverseMute) {
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

  async getSubjectsDueForReversal(): Promise<ReversalSubject[]> {
    const now = new Date().toISOString()
    const subjects = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('suspendUntil', '<', now)
      .orWhere('muteUntil', '<', now)
      .selectAll()
      .execute()

    return subjects.map((row) => ({
      subject: subjectFromStatusRow(row),
      reverseSuspend: !!row.suspendUntil && row.suspendUntil < now,
      reverseMute: !!row.muteUntil && row.muteUntil < now,
    }))
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
  }: ReversibleModerationEvent): Promise<ModerationEventRow> {
    const isRevertingTakedown =
      action === 'com.atproto.admin.defs#modEventTakedown'
    this.db.assertTransaction()
    const { event } = await this.logEvent({
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

    if (isRevertingTakedown) {
      if (subject.isRepo()) {
        await this.reverseTakedownRepo(subject)
      } else if (subject.isRecord()) {
        await this.reverseTakedownRecord(subject)
      }
    }

    return event
  }

  async takedownRepo(
    subject: RepoSubject,
    takedownId: number,
    isSuspend = false,
  ) {
    const takedownRef = `BSKY-${
      isSuspend ? 'SUSPEND' : 'TAKEDOWN'
    }-${takedownId}`
    const values = TAKEDOWNS.map((eventType) => ({
      eventType,
      subjectDid: subject.did,
      takedownRef,
    }))

    const repoEvts = await this.db.db
      .insertInto('repo_push_event')
      .values(values)
      .onConflict((oc) =>
        oc.columns(['subjectDid', 'eventType']).doUpdateSet({
          takedownRef,
          confirmedAt: null,
          attempts: 0,
          lastAttempted: null,
        }),
      )
      .returning('id')
      .execute()
    await this.formatAndCreateLabels(subject.did, null, {
      create: [UNSPECCED_TAKEDOWN_LABEL],
    })

    this.db.onCommit(() => {
      this.backgroundQueue.add(async () => {
        await Promise.all(
          repoEvts.map((evt) => this.eventPusher.attemptRepoEvent(evt.id)),
        )
      })
    })
  }

  async reverseTakedownRepo(subject: RepoSubject) {
    const repoEvts = await this.db.db
      .updateTable('repo_push_event')
      .where('eventType', 'in', TAKEDOWNS)
      .where('subjectDid', '=', subject.did)
      .set({
        takedownRef: null,
        confirmedAt: null,
        attempts: 0,
        lastAttempted: null,
      })
      .returning('id')
      .execute()
    await this.formatAndCreateLabels(subject.did, null, {
      negate: [UNSPECCED_TAKEDOWN_LABEL],
    })

    this.db.onCommit(() => {
      this.backgroundQueue.add(async () => {
        await Promise.all(
          repoEvts.map((evt) => this.eventPusher.attemptRepoEvent(evt.id)),
        )
      })
    })
  }

  async takedownRecord(subject: RecordSubject, takedownId: number) {
    this.db.assertTransaction()
    const takedownRef = `BSKY-TAKEDOWN-${takedownId}`
    const values = TAKEDOWNS.map((eventType) => ({
      eventType,
      subjectDid: subject.did,
      subjectUri: subject.uri,
      subjectCid: subject.cid,
      takedownRef,
    }))
    const blobCids = subject.blobCids
    const labels: string[] = [UNSPECCED_TAKEDOWN_LABEL]
    if (blobCids && blobCids.length > 0) {
      labels.push(UNSPECCED_TAKEDOWN_BLOBS_LABEL)
    }
    const recordEvts = await this.db.db
      .insertInto('record_push_event')
      .values(values)
      .onConflict((oc) =>
        oc.columns(['subjectUri', 'eventType']).doUpdateSet({
          takedownRef,
          confirmedAt: null,
          attempts: 0,
          lastAttempted: null,
        }),
      )
      .returning('id')
      .execute()
    await this.formatAndCreateLabels(subject.uri, subject.cid, {
      create: labels,
    })

    this.db.onCommit(() => {
      this.backgroundQueue.add(async () => {
        await Promise.all(
          recordEvts.map((evt) => this.eventPusher.attemptRecordEvent(evt.id)),
        )
      })
    })

    if (blobCids && blobCids.length > 0) {
      const blobValues: Insertable<BlobPushEvent>[] = []
      for (const eventType of TAKEDOWNS) {
        for (const cid of blobCids) {
          blobValues.push({
            eventType,
            subjectDid: subject.did,
            subjectBlobCid: cid.toString(),
            takedownRef,
          })
        }
      }
      const blobEvts = await this.db.db
        .insertInto('blob_push_event')
        .values(blobValues)
        .onConflict((oc) =>
          oc
            .columns(['subjectDid', 'subjectBlobCid', 'eventType'])
            .doUpdateSet({
              takedownRef,
              confirmedAt: null,
              attempts: 0,
              lastAttempted: null,
            }),
        )
        .returning(['id', 'subjectDid', 'subjectBlobCid', 'eventType'])
        .execute()

      this.db.onCommit(() => {
        this.backgroundQueue.add(async () => {
          await Promise.allSettled(
            blobEvts.map((evt) =>
              this.eventPusher
                .attemptBlobEvent(evt.id)
                .catch((err) =>
                  log.error({ err, ...evt }, 'failed to push blob event'),
                ),
            ),
          )

          if (this.imgInvalidator) {
            await Promise.allSettled(
              (subject.blobCids ?? []).map((cid) => {
                const paths = (this.cdnPaths ?? []).map((path) =>
                  path.replace('%s', subject.did).replace('%s', cid),
                )
                return this.imgInvalidator
                  ?.invalidate(cid, paths)
                  .catch((err) =>
                    log.error(
                      { err, paths, cid },
                      'failed to invalidate blob on cdn',
                    ),
                  )
              }),
            )
          }
        })
      })
    }
  }

  async reverseTakedownRecord(subject: RecordSubject) {
    this.db.assertTransaction()
    const labels: string[] = [UNSPECCED_TAKEDOWN_LABEL]
    const blobCids = subject.blobCids
    if (blobCids && blobCids.length > 0) {
      labels.push(UNSPECCED_TAKEDOWN_BLOBS_LABEL)
    }
    const recordEvts = await this.db.db
      .updateTable('record_push_event')
      .where('eventType', 'in', TAKEDOWNS)
      .where('subjectDid', '=', subject.did)
      .where('subjectUri', '=', subject.uri)
      .set({
        takedownRef: null,
        confirmedAt: null,
        attempts: 0,
        lastAttempted: null,
      })
      .returning('id')
      .execute()
    await this.formatAndCreateLabels(subject.uri, subject.cid, {
      negate: labels,
    }),
      this.db.onCommit(() => {
        this.backgroundQueue.add(async () => {
          await Promise.all(
            recordEvts.map((evt) =>
              this.eventPusher.attemptRecordEvent(evt.id),
            ),
          )
        })
      })

    if (blobCids && blobCids.length > 0) {
      const blobEvts = await this.db.db
        .updateTable('blob_push_event')
        .where('eventType', 'in', TAKEDOWNS)
        .where('subjectDid', '=', subject.did)
        .where(
          'subjectBlobCid',
          'in',
          blobCids.map((c) => c.toString()),
        )
        .set({
          takedownRef: null,
          confirmedAt: null,
          attempts: 0,
          lastAttempted: null,
        })
        .returning('id')
        .execute()

      this.db.onCommit(() => {
        this.backgroundQueue.add(async () => {
          await Promise.all(
            blobEvts.map((evt) => this.eventPusher.attemptBlobEvent(evt.id)),
          )
        })
      })
    }
  }

  async report(info: {
    reasonType: NonNullable<ModerationEventRow['meta']>['reportType']
    reason?: string
    subject: ModSubject
    reportedBy: string
    createdAt?: Date
  }): Promise<{
    event: ModerationEventRow
    subjectStatus: ModerationSubjectStatusRow | null
  }> {
    const {
      reasonType,
      reason,
      reportedBy,
      createdAt = new Date(),
      subject,
    } = info

    const result = await this.logEvent({
      event: {
        $type: 'com.atproto.admin.defs#modEventReport',
        reportType: reasonType,
        comment: reason,
      },
      createdBy: reportedBy,
      subject,
      createdAt,
    })

    return result
  }

  async getSubjectStatuses({
    cursor,
    limit = 50,
    takendown,
    appealed,
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
    tags,
    excludeTags,
  }: {
    cursor?: string
    limit?: number
    takendown?: boolean
    appealed?: boolean | null
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
    tags: string[]
    excludeTags: string[]
  }) {
    let builder = this.db.db.selectFrom('moderation_subject_status').selectAll()
    const { ref } = this.db.db.dynamic

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

    if (appealed !== undefined) {
      builder =
        appealed === null
          ? builder.where('appealed', 'is', null)
          : builder.where('appealed', '=', appealed)
    }

    if (!includeMuted) {
      builder = builder.where((qb) =>
        qb
          .where('muteUntil', '<', new Date().toISOString())
          .orWhere('muteUntil', 'is', null),
      )
    }

    if (tags.length) {
      builder = builder.where(
        sql`${ref('moderation_subject_status.tags')} @> ${jsonb(tags)}`,
      )
    }

    if (excludeTags.length) {
      builder = builder.where((qb) =>
        qb
          .where(
            sql`NOT(${ref('moderation_subject_status.tags')} @> ${jsonb(
              excludeTags,
            )})`,
          )
          .orWhere('tags', 'is', null),
      )
    }

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

    const infos = await this.views.getAccoutInfosByDid(
      results.map((r) => r.did),
    )
    const resultsWithHandles = results.map((r) => ({
      ...r,
      handle: infos.get(r.did)?.handle ?? INVALID_HANDLE,
    }))

    return {
      statuses: resultsWithHandles,
      cursor: keyset.packFromResult(results),
    }
  }

  async getStatus(
    subject: ModSubject,
  ): Promise<ModerationSubjectStatusRow | null> {
    const result = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', subject.did)
      .where('recordPath', '=', subject.recordPath ?? '')
      .selectAll()
      .executeTakeFirst()
    return result ?? null
  }

  async formatAndCreateLabels(
    uri: string,
    cid: string | null,
    labels: { create?: string[]; negate?: string[] },
  ): Promise<Label[]> {
    const { create = [], negate = [] } = labels
    const toCreate = create.map((val) => ({
      src: this.serverDid,
      uri,
      cid: cid ?? undefined,
      val,
      neg: false,
      cts: new Date().toISOString(),
    }))
    const toNegate = negate.map((val) => ({
      src: this.serverDid,
      uri,
      cid: cid ?? undefined,
      val,
      neg: true,
      cts: new Date().toISOString(),
    }))
    const formatted = [...toCreate, ...toNegate]
    await this.createLabels(formatted)
    return formatted
  }

  async createLabels(labels: Label[]) {
    if (labels.length < 1) return
    const dbVals = labels.map((l) => ({
      ...l,
      cid: l.cid ?? '',
      neg: !!l.neg,
    }))
    const { ref } = this.db.db.dynamic
    await sql`notify ${ref(LabelChannel)}`.execute(this.db.db)
    const excluded = (col: string) => ref(`excluded.${col}`)
    await this.db.db
      .insertInto('label')
      .values(dbVals)
      .onConflict((oc) =>
        oc.columns(['src', 'uri', 'cid', 'val']).doUpdateSet({
          id: sql`${excluded('id')}`,
          neg: sql`${excluded('neg')}`,
          cts: sql`${excluded('cts')}`,
        }),
      )
      .execute()
  }
}

const TAKEDOWNS = ['pds_takedown' as const, 'appview_takedown' as const]

export type TakedownSubjects = {
  did: string
  subjects: (RepoRef | RepoBlobRef | StrongRef)[]
}

export type ReversalSubject = {
  subject: ModSubject
  reverseSuspend: boolean
  reverseMute: boolean
}
