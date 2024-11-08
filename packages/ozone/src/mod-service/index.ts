import net from 'node:net'
import { Insertable, sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri, INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { addHoursToDate, chunkArray } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { Database } from '../db'
import { AuthHeaders, ModerationViews } from './views'
import { Main as StrongRef } from '../lexicon/types/com/atproto/repo/strongRef'
import {
  isModEventComment,
  isModEventLabel,
  isModEventMute,
  isModEventReport,
  isModEventTakedown,
  isModEventEmail,
  isModEventTag,
  isAccountEvent,
  isIdentityEvent,
  isRecordEvent,
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { RepoRef, RepoBlobRef } from '../lexicon/types/com/atproto/admin/defs'
import {
  adjustModerationSubjectStatus,
  getStatusIdentifierFromSubject,
} from './status'
import {
  ModEventType,
  ModerationEventRow,
  ModerationSubjectStatusRow,
  ReversibleModerationEvent,
} from './types'
import { ModerationEvent } from '../db/schema/moderation_event'
import { StatusKeyset, TimeIdKeyset, paginate } from '../db/pagination'
import { Label } from '../lexicon/types/com/atproto/label/defs'
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
import { formatLabel, formatLabelRow, signLabel } from './util'
import { ImageInvalidator } from '../image-invalidator'
import { httpLogger as log } from '../logger'
import { OzoneConfig } from '../config'
import { LABELER_HEADER_NAME, ParsedLabelers } from '../util'
import { ids } from '../lexicon/lexicons'

export type ModerationServiceCreator = (db: Database) => ModerationService

export class ModerationService {
  constructor(
    public db: Database,
    public signingKey: Keypair,
    public signingKeyId: number,
    public cfg: OzoneConfig,
    public backgroundQueue: BackgroundQueue,
    public idResolver: IdResolver,
    public eventPusher: EventPusher,
    public appviewAgent: AtpAgent,
    private createAuthHeaders: (
      aud: string,
      method: string,
    ) => Promise<AuthHeaders>,
    public imgInvalidator?: ImageInvalidator,
  ) {}

  static creator(
    signingKey: Keypair,
    signingKeyId: number,
    cfg: OzoneConfig,
    backgroundQueue: BackgroundQueue,
    idResolver: IdResolver,
    eventPusher: EventPusher,
    appviewAgent: AtpAgent,
    createAuthHeaders: (aud: string, method: string) => Promise<AuthHeaders>,
    imgInvalidator?: ImageInvalidator,
  ) {
    return (db: Database) =>
      new ModerationService(
        db,
        signingKey,
        signingKeyId,
        cfg,
        backgroundQueue,
        idResolver,
        eventPusher,
        appviewAgent,
        createAuthHeaders,
        imgInvalidator,
      )
  }

  views = new ModerationViews(
    this.db,
    this.signingKey,
    this.signingKeyId,
    this.appviewAgent,
    async (method: string, labelers?: ParsedLabelers) => {
      const authHeaders = await this.createAuthHeaders(
        this.cfg.appview.did,
        method,
      )
      if (labelers?.dids?.length) {
        authHeaders.headers[LABELER_HEADER_NAME] = labelers.dids.join(', ')
      }
      return authHeaders
    },
  )

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
    collections: string[]
    subjectType?: string
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
      collections,
      subjectType,
    } = opts
    const { ref } = this.db.db.dynamic
    let builder = this.db.db.selectFrom('moderation_event').selectAll()

    if (subject) {
      const isSubjectAtUri = subject.startsWith('at://')
      const subjectDid = isSubjectAtUri ? new AtUri(subject).hostname : subject
      const subjectUri = isSubjectAtUri ? subject : null
      // regardless of subjectUri check, we always want to query against subjectDid column since that's indexed
      builder = builder.where('subjectDid', '=', subjectDid)

      // if requester wants to include all user records, let's ignore matching on subjectUri
      if (!includeAllUserRecords) {
        builder = builder
          .if(!subjectUri, (q) => q.where('subjectUri', 'is', null))
          .if(!!subjectUri, (q) => q.where('subjectUri', '=', subjectUri))
      }
    } else if (subjectType === 'account') {
      builder = builder.where('subjectUri', 'is', null)
    } else if (subjectType === 'record') {
      builder = builder.where('subjectUri', 'is not', null)
    }

    // If subjectType is set to 'account' let that take priority and ignore collections filter
    if (collections.length && subjectType !== 'account') {
      builder = builder.where('subjectUri', 'is not', null).where((qb) => {
        collections.forEach((collection) => {
          qb = qb.orWhere('subjectUri', 'like', `%/${collection}/%`)
        })
        return qb
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
      .where('action', '=', 'tools.ozone.moderation.defs#modEventReport')
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

  async resolveSubjectsForAccount(did: string, createdBy: string) {
    const subjectsToBeResolved = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '!=', '')
      .where('reviewState', 'in', [REVIEWESCALATED, REVIEWOPEN])
      .selectAll()
      .execute()

    if (subjectsToBeResolved.length === 0) {
      return
    }

    // Process subjects in chunks of 100 since each of these will trigger multiple db queries
    for (const subjects of chunkArray(subjectsToBeResolved, 100)) {
      await Promise.all(
        subjects.map(async (subject) => {
          const eventData = {
            createdBy,
            subject: subjectFromStatusRow(subject),
          }
          // For consistency's sake, when acknowledging appealed subjects, we should first resolve the appeal
          if (subject.appealed) {
            await this.logEvent({
              event: {
                $type: 'tools.ozone.moderation.defs#modEventResolveAppeal',
                comment:
                  '[AUTO_RESOLVE_FOR_TAKENDOWN_ACCOUNT]: Automatically resolving all appealed content for a takendown account',
              },
              ...eventData,
            })
          }

          await this.logEvent({
            event: {
              $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
              comment:
                '[AUTO_RESOLVE_FOR_TAKENDOWN_ACCOUNT]: Automatically resolving all reported content for a takendown account',
            },
            ...eventData,
          })
        }),
      )
    }
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
      if (event.content) {
        meta.content = event.content
      }
    }

    if (isAccountEvent(event)) {
      meta.active = event.active
      meta.timestamp = event.timestamp
      if (event.status) meta.status = event.status
    }

    if (isIdentityEvent(event)) {
      meta.timestamp = event.timestamp
      if (event.handle) meta.handle = event.handle
      if (event.pdsHost) meta.pdsHost = event.pdsHost
      if (event.tombstone) meta.tombstone = event.tombstone
    }

    if (isRecordEvent(event)) {
      meta.timestamp = event.timestamp
      meta.op = event.op
      if (event.cid) meta.cid = event.cid
    }

    if (isModEventTakedown(event) && event.acknowledgeAccountSubjects) {
      meta.acknowledgeAccountSubjects = true
    }

    // Keep trace of reports that came in while the reporter was in muted stated
    if (isModEventReport(event)) {
      const isReportingMuted = await this.isReportingMutedForSubject(createdBy)
      if (isReportingMuted) {
        meta.isReporterMuted = true
      }
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
        meta: Object.assign(meta, subjectInfo.meta),
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
        subjectMessageId: subjectInfo.subjectMessageId,
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
        .where('action', '=', 'tools.ozone.moderation.defs#modEventTakedown')
        .where('durationInHours', 'is not', null)
    }
    if (subject.reverseMute) {
      builder = builder
        .where('action', '=', 'tools.ozone.moderation.defs#modEventMute')
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
      action === 'tools.ozone.moderation.defs#modEventTakedown'
    this.db.assertTransaction()
    const { event } = await this.logEvent({
      event: {
        $type: isRevertingTakedown
          ? 'tools.ozone.moderation.defs#modEventReverseTakedown'
          : 'tools.ozone.moderation.defs#modEventUnmute',
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

    const values = this.eventPusher.takedowns.map((eventType) => ({
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

    const takedownLabel = isSuspend ? SUSPEND_LABEL : TAKEDOWN_LABEL
    await this.formatAndCreateLabels(subject.did, null, {
      create: [takedownLabel],
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

    const existingTakedownLabels = await this.db.db
      .selectFrom('label')
      .where('label.uri', '=', subject.did)
      .where('label.val', 'in', [TAKEDOWN_LABEL, SUSPEND_LABEL])
      .where('neg', '=', false)
      .selectAll()
      .execute()

    const takedownVals = existingTakedownLabels.map((row) => row.val)
    await this.formatAndCreateLabels(subject.did, null, {
      negate: takedownVals,
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
    await this.formatAndCreateLabels(subject.uri, subject.cid, {
      create: [TAKEDOWN_LABEL],
    })

    const takedownRef = `BSKY-TAKEDOWN-${takedownId}`
    const blobCids = subject.blobCids
    if (blobCids && blobCids.length > 0) {
      const blobValues: Insertable<BlobPushEvent>[] = []
      for (const eventType of this.eventPusher.takedowns) {
        for (const cid of blobCids) {
          blobValues.push({
            eventType,
            takedownRef,
            subjectDid: subject.did,
            subjectUri: subject.uri || null,
            subjectBlobCid: cid.toString(),
          })
        }
      }
      const blobEvts = await this.eventPusher.logBlobPushEvent(
        blobValues,
        takedownRef,
      )

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
                const paths = (this.cfg.cdn.paths ?? []).map((path) =>
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
    await this.formatAndCreateLabels(subject.uri, subject.cid, {
      negate: [TAKEDOWN_LABEL],
    })

    const blobCids = subject.blobCids
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
        $type: 'tools.ozone.moderation.defs#modEventReport',
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
    includeAllUserRecords,
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
    hostingDeletedBefore,
    hostingDeletedAfter,
    hostingUpdatedBefore,
    hostingUpdatedAfter,
    hostingStatuses,
    onlyMuted,
    ignoreSubjects,
    sortDirection,
    lastReviewedBy,
    sortField,
    subject,
    tags,
    excludeTags,
    collections,
    subjectType,
  }: {
    includeAllUserRecords?: boolean
    cursor?: string
    limit?: number
    takendown?: boolean
    appealed?: boolean
    reviewedBefore?: string
    reviewState?: ModerationSubjectStatusRow['reviewState']
    reviewedAfter?: string
    reportedAfter?: string
    reportedBefore?: string
    includeMuted?: boolean
    hostingDeletedBefore?: string
    hostingDeletedAfter?: string
    hostingUpdatedBefore?: string
    hostingUpdatedAfter?: string
    hostingStatuses?: string[]
    onlyMuted?: boolean
    subject?: string
    ignoreSubjects?: string[]
    sortDirection: 'asc' | 'desc'
    lastReviewedBy?: string
    sortField: 'lastReviewedAt' | 'lastReportedAt'
    tags: string[]
    excludeTags: string[]
    collections: string[]
    subjectType?: string
  }) {
    let builder = this.db.db.selectFrom('moderation_subject_status').selectAll()
    const { ref } = this.db.db.dynamic

    if (subject) {
      const subjectInfo = getStatusIdentifierFromSubject(subject)
      builder = builder.where(
        'moderation_subject_status.did',
        '=',
        subjectInfo.did,
      )

      if (!includeAllUserRecords) {
        builder = builder.where((qb) =>
          subjectInfo.recordPath
            ? qb.where('recordPath', '=', subjectInfo.recordPath)
            : qb.where('recordPath', '=', ''),
        )
      }
    } else if (subjectType === 'account') {
      builder = builder.where('recordPath', '=', '')
    } else if (subjectType === 'record') {
      builder = builder.where('recordPath', '!=', '')
    }

    // If subjectType is set to 'account' let that take priority and ignore collections filter
    if (collections.length && subjectType !== 'account') {
      builder = builder.where('recordPath', '!=', '').where((qb) => {
        collections.forEach((collection) => {
          qb = qb.orWhere('recordPath', 'like', `${collection}/%`)
        })
        return qb
      })
    }

    if (ignoreSubjects?.length) {
      builder = builder
        .where('did', 'not in', ignoreSubjects)
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

    if (hostingUpdatedAfter) {
      builder = builder.where('hostingUpdatedAt', '>', hostingUpdatedAfter)
    }

    if (hostingUpdatedBefore) {
      builder = builder.where('hostingUpdatedAt', '<', hostingUpdatedBefore)
    }

    if (hostingDeletedAfter) {
      builder = builder.where('hostingDeletedAt', '>', hostingDeletedAfter)
    }

    if (hostingDeletedBefore) {
      builder = builder.where('hostingDeletedAt', '<', hostingDeletedBefore)
    }

    if (hostingStatuses?.length) {
      builder = builder.where('hostingStatus', 'in', hostingStatuses)
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
        appealed === false
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

    if (onlyMuted) {
      builder = builder.where((qb) =>
        qb
          .where('muteUntil', '>', new Date().toISOString())
          .orWhere('muteReportingUntil', '>', new Date().toISOString()),
      )
    }

    if (tags.length) {
      builder = builder.where(
        sql`${ref('moderation_subject_status.tags')} ?| array[${sql.join(
          tags,
        )}]::TEXT[]`,
      )
    }

    if (excludeTags.length) {
      builder = builder.where((qb) =>
        qb
          .where(
            sql`NOT(${ref(
              'moderation_subject_status.tags',
            )} ?| array[${sql.join(excludeTags)}]::TEXT[])`,
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

  // This is used to check if the reporter of an incoming report is muted from reporting
  // so we want to make sure this look up is as fast as possible
  async isReportingMutedForSubject(did: string) {
    const result = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('muteReportingUntil', '>', new Date().toISOString())
      .select(sql`true`.as('status'))
      .executeTakeFirst()

    return !!result
  }

  async formatAndCreateLabels(
    uri: string,
    cid: string | null,
    labels: { create?: string[]; negate?: string[] },
  ): Promise<Label[]> {
    const { create = [], negate = [] } = labels
    const toCreate = create.map((val) => ({
      src: this.cfg.service.did,
      uri,
      cid: cid ?? undefined,
      val,
      cts: new Date().toISOString(),
    }))
    const toNegate = negate.map((val) => ({
      src: this.cfg.service.did,
      uri,
      cid: cid ?? undefined,
      val,
      neg: true,
      cts: new Date().toISOString(),
    }))
    const formatted = [...toCreate, ...toNegate]
    return this.createLabels(formatted)
  }

  async createLabels(labels: Label[]): Promise<Label[]> {
    if (labels.length < 1) return []
    const signedLabels = await Promise.all(
      labels.map((l) => signLabel(l, this.signingKey)),
    )
    const dbVals = signedLabels.map((l) => formatLabelRow(l, this.signingKeyId))
    const { ref } = this.db.db.dynamic
    await sql`notify ${ref(LabelChannel)}`.execute(this.db.db)
    const excluded = (col: string) => ref(`excluded.${col}`)
    const res = await this.db.db
      .insertInto('label')
      .values(dbVals)
      .onConflict((oc) =>
        oc.columns(['src', 'uri', 'cid', 'val']).doUpdateSet({
          id: sql`${excluded('id')}`,
          neg: sql`${excluded('neg')}`,
          cts: sql`${excluded('cts')}`,
          exp: sql`${excluded('exp')}`,
          sig: sql`${excluded('sig')}`,
          signingKeyId: sql`${excluded('signingKeyId')}`,
        }),
      )
      .returningAll()
      .execute()
    return res.map((row) => formatLabel(row))
  }

  async sendEmail(opts: {
    content: string
    recipientDid: string
    subject: string
  }) {
    const { subject, content, recipientDid } = opts
    const { pds } = await this.idResolver.did.resolveAtprotoData(recipientDid)
    const url = new URL(pds)
    if (!this.cfg.service.devMode && !isSafeUrl(url)) {
      throw new InvalidRequestError('Invalid pds service in DID doc')
    }
    const agent = new AtpAgent({ service: url })
    const { data: serverInfo } = await agent.com.atproto.server.describeServer()
    if (serverInfo.did !== `did:web:${url.hostname}`) {
      // @TODO do bidirectional check once implemented. in the meantime,
      // matching did to hostname we're talking to is pretty good.
      throw new InvalidRequestError('Invalid pds service in DID doc')
    }
    const { data: delivery } = await agent.com.atproto.admin.sendEmail(
      {
        subject,
        content,
        recipientDid,
        senderDid: this.cfg.service.did,
      },
      {
        encoding: 'application/json',
        ...(await this.createAuthHeaders(
          serverInfo.did,
          ids.ComAtprotoAdminSendEmail,
        )),
      },
    )
    if (!delivery.sent) {
      throw new InvalidRequestError('Email was accepted but not sent')
    }
  }
}

const isSafeUrl = (url: URL) => {
  if (url.protocol !== 'https:') return false
  if (!url.hostname || url.hostname === 'localhost') return false
  if (net.isIP(url.hostname) !== 0) return false
  return true
}

const TAKEDOWNS = ['pds_takedown' as const, 'appview_takedown' as const]

export const TAKEDOWN_LABEL = '!takedown'
export const SUSPEND_LABEL = '!suspend'

export type TakedownSubjects = {
  did: string
  subjects: (RepoRef | RepoBlobRef | StrongRef)[]
}

export type ReversalSubject = {
  subject: ModSubject
  reverseSuspend: boolean
  reverseMute: boolean
}
