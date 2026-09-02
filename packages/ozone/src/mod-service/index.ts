import { type Expression, type Insertable, sql } from 'kysely'
import { addHoursToDate, chunkArray } from '@atproto/common'
import type { Keypair } from '@atproto/crypto'
import type { IdResolver } from '@atproto/identity'
import {
  type Client,
  type DatetimeString,
  type DidString,
  type UriString,
  currentDatetimeString,
  isDidString,
  toDatetimeString,
} from '@atproto/lex'
import { AtUri, INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { getReviewState } from '../api/util.js'
import type { BackgroundQueue } from '../background.js'
import type { OzoneConfig } from '../config/index.js'
import type { EventPusher } from '../daemon/index.js'
import type { Database } from '../db/index.js'
import { StatusKeyset, TimeIdKeyset, paginate } from '../db/pagination.js'
import type { BlobPushEvent } from '../db/schema/blob_push_event.js'
import { LabelChannel } from '../db/schema/label.js'
import type { ModerationEvent } from '../db/schema/moderation_event.js'
import { jsonb } from '../db/types.js'
import type { ImageInvalidator } from '../image-invalidator.js'
import { com, tools } from '../lexicons/index.js'
import { httpLogger as log } from '../logger.js'
import { LABELER_HEADER_NAME, type ParsedLabelers } from '../util.js'
import { insertExpiringTags, removeExpiringTags } from './expiring-tags.js'
import {
  adjustModerationSubjectStatus,
  getStatusIdentifierFromSubject,
  moderationSubjectStatusQueryBuilder,
} from './status.js'
import type { StrikeService, StrikeServiceCreator } from './strike.js'
import {
  CHAT_CONVO_COLLECTION,
  type ModSubject,
  type RecordSubject,
  type RepoSubject,
  subjectFromStatusRow,
} from './subject.js'
import type {
  ModEventType,
  ModerationEventRow,
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRow,
  ModerationSubjectStatusRowWithHandle,
  ReporterStats,
  ReporterStatsResult,
  ReversibleModerationEvent,
} from './types.js'
import {
  dateFromDbDatetime,
  formatLabel,
  formatLabelRow,
  getPdsClientForRepo,
  signLabel,
} from './util.js'
import { type AuthHeaders, ModerationViews } from './views.js'

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
    public appviewClient: Client,
    private createAuthHeaders: (
      aud: string,
      method: string,
    ) => Promise<AuthHeaders>,
    public strikeService: StrikeService,
    public imgInvalidator?: ImageInvalidator,
  ) {}

  static creator(
    signingKey: Keypair,
    signingKeyId: number,
    cfg: OzoneConfig,
    backgroundQueue: BackgroundQueue,
    idResolver: IdResolver,
    eventPusher: EventPusher,
    appviewClient: Client,
    createAuthHeaders: (aud: string, method: string) => Promise<AuthHeaders>,
    strikeServiceCreator: StrikeServiceCreator,
    imgInvalidator?: ImageInvalidator,
  ) {
    return (db: Database) => {
      const strikeService = strikeServiceCreator(db)
      return new ModerationService(
        db,
        signingKey,
        signingKeyId,
        cfg,
        backgroundQueue,
        idResolver,
        eventPusher,
        appviewClient,
        createAuthHeaders,
        strikeService,
        imgInvalidator,
      )
    }
  }

  views = new ModerationViews(
    this.db,
    this.signingKey,
    this.signingKeyId,
    this.appviewClient,
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
    this.idResolver,
    this.cfg.service.devMode,
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

  async getEventByExternalId(
    eventType: ModerationEvent['action'],
    externalId: string,
    subject: ModSubject,
  ): Promise<boolean> {
    const result = await this.db.db
      .selectFrom('moderation_event')
      .where('action', '=', eventType)
      .where('externalId', '=', externalId)
      .where('subjectDid', '=', subject.did)
      .select(sql`1`.as('exists'))
      .limit(1)
      .executeTakeFirst()
    return !!result
  }

  async getEvents(opts: {
    subject?: string
    createdBy?: DidString
    limit: number
    cursor?: string
    includeAllUserRecords: boolean
    types: ModerationEvent['action'][]
    sortDirection?: 'asc' | 'desc'
    hasComment?: boolean
    comment?: string
    createdAfter?: DatetimeString
    createdBefore?: DatetimeString
    addedLabels: string[]
    removedLabels: string[]
    addedTags: string[]
    removedTags: string[]
    reportTypes?: string[]
    collections: string[]
    subjectType?: string
    policies?: string[]
    modTool?: string[]
    ageAssuranceState?: string
    batchId?: string
    withStrike?: boolean
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
      policies,
      modTool,
      ageAssuranceState,
      batchId,
      withStrike,
    } = opts
    const { ref } = this.db.db.dynamic
    let builder = this.db.db.selectFrom('moderation_event').selectAll()

    const subjectAtUri = subject?.startsWith('at://')
      ? new AtUri(subject)
      : null
    const subjectDid = subjectAtUri
      ? subjectAtUri.did
      : isDidString(subject)
        ? subject
        : null

    if (subjectDid) {
      const subjectUri = subjectAtUri ? subjectAtUri.href : null
      // regardless of subjectUri check, we always want to query against subjectDid column since that's indexed
      builder = builder.where('subjectDid', '=', subjectDid)

      // subjectUri or subjectConvoId
      if (!includeAllUserRecords) {
        if (subjectAtUri?.collection === CHAT_CONVO_COLLECTION) {
          builder = builder.where('subjectConvoId', '=', subjectAtUri.rkey)
        } else if (subjectUri) {
          builder = builder.where('subjectUri', '=', subjectUri)
        } else {
          // Account-level: subjectUri IS NULL also matches conversation events,
          // so explicitly exclude them.
          builder = builder
            .where('subjectUri', 'is', null)
            .where('subjectConvoId', 'is', null)
        }
      }
    } else if (subject) {
      // If subject is provided but not a valid DID or at:// URI, return no
      // results: equivalent to where did = 'invalid-did' which will never match
      // any rows.
      return { cursor: undefined, events: [] }
    } else if (subjectType === 'account') {
      builder = builder
        .where('subjectUri', 'is', null)
        .where('subjectConvoId', 'is', null)
    } else if (subjectType === 'record') {
      builder = builder.where('subjectUri', 'is not', null)
    } else if (subjectType === 'conversation') {
      builder = builder.where('subjectConvoId', 'is not', null)
    }

    // If subjectType is set to 'account' let that take priority and ignore collections filter
    if (collections.length && subjectType !== 'account') {
      builder = builder
        .where('subjectUri', 'is not', null)
        .where((eb) =>
          eb.or(
            collections.map((collection) =>
              eb('subjectUri', 'like', `%/${collection}/%` as any),
            ),
          ),
        )
    }

    if (types.length) {
      builder = builder.where((eb) => {
        if (types.length === 1) {
          return eb('action', '=', types[0])
        }

        return eb('action', 'in', types)
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
      // the input may end in || in which case, there may be item in the array which is just '' and we want to ignore those
      const keywords = comment.split('||').filter((keyword) => !!keyword.trim())
      if (keywords.length > 1) {
        builder = builder.where((eb) =>
          eb.or(
            keywords.map((keyword) => eb('comment', 'ilike', `%${keyword}%`)),
          ),
        )
      } else if (keywords.length === 1) {
        builder = builder.where('comment', 'ilike', `%${keywords[0]}%`)
      }
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
      builder = builder.where(
        sql<boolean>`${ref('addedTags')} @> ${jsonb(addedTags)}`,
      )
    }
    if (removedTags.length) {
      builder = builder.where(
        sql<boolean>`${ref('removedTags')} @> ${jsonb(removedTags)}`,
      )
    }
    if (reportTypes?.length) {
      builder = builder.where(sql`meta->>'reportType'`, 'in', reportTypes)
    }
    if (policies?.length) {
      builder = builder.where((eb) =>
        eb.or(
          policies.map((policy) =>
            eb(sql`meta->>'policies'`, 'ilike', `%${policy}%`),
          ),
        ),
      )
    }
    if (modTool?.length) {
      builder = builder
        .where('modTool', 'is not', null)
        .where(sql`("modTool" ->> 'name')`, 'in', modTool)
    }
    if (batchId) {
      builder = builder
        .where('modTool', 'is not', null)
        .where(sql`("modTool" -> 'meta' ->> 'batchId')`, '=', batchId)
    }
    if (ageAssuranceState) {
      builder = builder
        .where('action', 'in', [
          tools.ozone.moderation.defs.ageAssuranceEvent.$type,
          tools.ozone.moderation.defs.ageAssuranceOverrideEvent.$type,
        ])
        .where(sql`meta->>'status'`, '=', ageAssuranceState)
    }

    if (withStrike !== undefined) {
      builder = builder.where('strikeCount', 'is not', null)
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

  async getEventsByIds(ids: number[]): Promise<ModerationEventRowWithHandle[]> {
    if (!ids.length) return []

    const result = await this.db.db
      .selectFrom('moderation_event')
      .selectAll()
      .where('id', 'in', ids)
      .execute()

    if (!result.length) return []

    const infos = await this.views.getAccoutInfosByDid([
      ...result.map((row) => row.subjectDid),
      ...result.map((row) => row.createdBy),
    ])

    return result.map((r) => ({
      ...r,
      creatorHandle: infos.get(r.createdBy)?.handle,
      subjectHandle: infos.get(r.subjectDid)?.handle,
    }))
  }

  async getReport(id: number): Promise<ModerationEventRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_event')
      .where('action', '=', tools.ozone.moderation.defs.modEventReport.$type)
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async resolveSubjectsForAccount(
    did: DidString,
    createdBy: DidString,
    accountEvent: ModerationEventRow,
  ) {
    const subjectsToBeResolved = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where((eb) =>
        eb.or([eb('recordPath', '!=', ''), eb('convoId', '!=', '')]),
      )
      .where('reviewState', 'in', [
        tools.ozone.moderation.defs.ReviewEscalated,
        tools.ozone.moderation.defs.ReviewOpen,
      ])
      .selectAll()
      .execute()

    if (subjectsToBeResolved.length === 0) {
      return
    }

    let accountEventInfo = `Account Event ID: ${accountEvent.id}`
    if (accountEvent.comment) {
      accountEventInfo += ` | Account Event Comment: ${accountEvent.comment}`
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
              event: tools.ozone.moderation.defs.modEventResolveAppeal.$build({
                comment: `[AUTO_RESOLVE_ON_ACCOUNT_ACTION]: Automatically resolving all appealed content due to account level action | ${accountEventInfo}`,
              }),
              ...eventData,
            })
          }

          await this.logEvent({
            event: tools.ozone.moderation.defs.modEventAcknowledge.$build({
              comment: `[AUTO_RESOLVE_ON_ACCOUNT_ACTION]: Automatically resolving all reported content due to account level action | ${accountEventInfo}`,
            }),
            ...eventData,
          })
        }),
      )
    }
  }

  async logEvent(info: {
    event: ModEventType
    subject: ModSubject
    createdBy: DidString
    createdAt?: Date
    modTool?: NonNullable<ModerationEvent['modTool']>
    externalId?: string
  }): Promise<{
    event: ModerationEventRow
    subjectStatus: ModerationSubjectStatusRow | null
  }> {
    this.db.assertTransaction()
    const {
      event,
      subject,
      createdBy,
      externalId,
      createdAt = new Date(),
      modTool,
    } = info

    const createLabelVals =
      tools.ozone.moderation.defs.modEventLabel.$isTypeOf(event) &&
      event.createLabelVals.length > 0
        ? event.createLabelVals.join(' ')
        : undefined
    const negateLabelVals =
      tools.ozone.moderation.defs.modEventLabel.$isTypeOf(event) &&
      event.negateLabelVals.length > 0
        ? event.negateLabelVals.join(' ')
        : undefined

    const meta: Record<string, string | number | boolean> = {}

    const addedTags = tools.ozone.moderation.defs.modEventTag.$isTypeOf(event)
      ? jsonb(event.add)
      : null
    const removedTags = tools.ozone.moderation.defs.modEventTag.$isTypeOf(event)
      ? jsonb(event.remove)
      : null

    if (tools.ozone.moderation.defs.modEventReport.$isTypeOf(event)) {
      meta.reportType = event.reportType
    }

    if (
      tools.ozone.moderation.defs.modEventComment.$isTypeOf(event) &&
      event.sticky
    ) {
      meta.sticky = event.sticky
    }

    if (tools.ozone.moderation.defs.modEventEmail.$isTypeOf(event)) {
      meta.subjectLine = event.subjectLine
      meta.isDelivered = !!event.isDelivered
      if (event.content) {
        meta.content = event.content
      }
      if (event.policies?.length) {
        meta.policies = event.policies.join(',')
      }
    }

    if (tools.ozone.moderation.defs.accountEvent.$isTypeOf(event)) {
      meta.active = event.active
      meta.timestamp = event.timestamp
      if (event.status) meta.status = event.status
    }

    if (tools.ozone.moderation.defs.modEventPriorityScore.$isTypeOf(event)) {
      meta.priorityScore = event.score
    }

    if (tools.ozone.moderation.defs.identityEvent.$isTypeOf(event)) {
      meta.timestamp = event.timestamp
      if (event.handle) meta.handle = event.handle
      if (event.pdsHost) meta.pdsHost = event.pdsHost
      if (event.tombstone) meta.tombstone = event.tombstone
    }

    if (tools.ozone.moderation.defs.recordEvent.$isTypeOf(event)) {
      meta.timestamp = event.timestamp
      meta.op = event.op
      if (event.cid) meta.cid = event.cid
    }

    if (tools.ozone.moderation.defs.ageAssuranceEvent.$isTypeOf(event)) {
      meta.status = event.status
      meta.createdAt = event.createdAt
      if (event.attemptId) {
        meta.attemptId = event.attemptId
      }
      if (event.access) {
        meta.access = event.access
      }
      if (event.initIp) {
        meta.initIp = event.initIp
      }
      if (event.initUa) {
        meta.initUa = event.initUa
      }
      if (event.completeIp) {
        meta.completeIp = event.completeIp
      }
      if (event.completeUa) {
        meta.completeUa = event.completeUa
      }
    }

    if (
      tools.ozone.moderation.defs.ageAssuranceOverrideEvent.$isTypeOf(event)
    ) {
      meta.status = event.status
      if (event.access) {
        meta.access = event.access
      }
    }

    if (tools.ozone.moderation.defs.scheduleTakedownEvent.$isTypeOf(event)) {
      if (event.executeAfter) {
        meta.executeAfter = event.executeAfter
      }
      if (event.executeAt) {
        meta.executeAt = event.executeAt
      }
      if (event.executeUntil) {
        meta.executeUntil = event.executeUntil
      }
    }

    if (
      (tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
        tools.ozone.moderation.defs.modEventAcknowledge.$isTypeOf(event)) &&
      event.acknowledgeAccountSubjects
    ) {
      meta.acknowledgeAccountSubjects = true
    }

    if (
      tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) &&
      event.policies?.length
    ) {
      meta.policies = event.policies.join(',')
    }

    if (
      tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) &&
      event.targetServices?.length
    ) {
      meta.targetServices = event.targetServices.join(',')
    }

    // Keep trace of reports that came in while the reporter was in muted stated
    if (tools.ozone.moderation.defs.modEventReport.$isTypeOf(event)) {
      const isReportingMuted = await this.isReportingMutedForSubject(createdBy)
      if (isReportingMuted) {
        meta.isReporterMuted = true
      }
      // Also capture whether the subject was muted at event-creation time, so
      // the queue-router daemon can populate report.isMuted later without
      // racing against subsequent mute/unmute changes.
      const isSubjectMuted = await this.isSubjectMuted(subject.did)
      if (isSubjectMuted) {
        meta.isSubjectMuted = true
      }
    }

    const subjectInfo = subject.info()

    // Store severityLevel, strikeCount, and strikeExpiresAt if provided
    // These values should be calculated by the client based on configuration
    // processNewEvent will update the account_strike table with the new strike count
    let severityLevel: string | null = null
    let strikeCount: number | null = null
    let strikeExpiresAt: DatetimeString | null = null

    if (
      tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventEmail.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventReverseTakedown.$isTypeOf(event)
    ) {
      // Store severityLevel if provided (for display/tracking)
      if (event.severityLevel) {
        severityLevel = event.severityLevel
      }
      // Store explicit strikeCount if provided
      if (event.strikeCount !== undefined) {
        strikeCount = event.strikeCount
      }
      // Store strikeExpiresAt if provided by client
      if ('strikeExpiresAt' in event && event.strikeExpiresAt) {
        strikeExpiresAt = event.strikeExpiresAt
      }
    }

    const modEvent = await this.db.db
      .insertInto('moderation_event')
      .values({
        comment:
          ('comment' in event &&
            typeof event.comment === 'string' &&
            event.comment) ||
          null,
        action: event.$type as ModerationEvent['action'],
        createdAt: toDatetimeString(createdAt),
        createdBy,
        createLabelVals,
        negateLabelVals,
        addedTags,
        removedTags,
        durationInHours:
          'durationInHours' in event && event.durationInHours
            ? Number(event.durationInHours)
            : null,
        meta: Object.assign(meta, subjectInfo.meta),
        expiresAt:
          (tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
            tools.ozone.moderation.defs.modEventMute.$isTypeOf(event)) &&
          event.durationInHours
            ? toDatetimeString(addHoursToDate(event.durationInHours, createdAt))
            : undefined,
        subjectType: subjectInfo.subjectType,
        subjectDid: subjectInfo.subjectDid,
        subjectUri: subjectInfo.subjectUri,
        subjectCid: subjectInfo.subjectCid,
        subjectBlobCids: jsonb(subjectInfo.subjectBlobCids),
        subjectMessageId: subjectInfo.subjectMessageId,
        subjectConvoId: subjectInfo.subjectConvoId,
        modTool: modTool ? jsonb(modTool) : null,
        externalId: externalId ?? null,
        severityLevel,
        strikeCount,
        strikeExpiresAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const subjectStatus = await adjustModerationSubjectStatus(
      this.db,
      modEvent,
      subject.blobCids,
    )

    // Manage expiring tag rows for temporary tags
    if (tools.ozone.moderation.defs.modEventTag.$isTypeOf(event)) {
      if (event.durationInHours && event.add.length > 0) {
        const expiresAt = toDatetimeString(
          addHoursToDate(event.durationInHours, createdAt),
        )
        await insertExpiringTags(this.db, {
          eventId: modEvent.id,
          did: subjectInfo.subjectDid,
          recordPath: subjectInfo.subjectUri ?? '',
          convoId: subjectInfo.subjectConvoId ?? '',
          tags: event.add,
          expiresAt: expiresAt as DatetimeString,
          createdBy,
        })
      }
      if (event.remove.length > 0) {
        await removeExpiringTags(this.db, {
          did: subjectInfo.subjectDid,
          recordPath: subjectInfo.subjectUri ?? '',
          convoId: subjectInfo.subjectConvoId ?? '',
          tags: event.remove,
        })
      }
    }

    if (tools.ozone.moderation.defs.ageAssurancePurgeEvent.$isTypeOf(event)) {
      await this.purgeAgeAssuranceEvents(subjectInfo.subjectDid)
    }

    // Updates are only needed if strikeCount is numeric (in some cases even 0)
    if (modEvent.strikeCount !== null) {
      try {
        await this.strikeService.updateSubjectStrikeCount(modEvent.subjectDid)
      } catch (error) {
        // Log error but don't fail the entire operation to ensure that events are logged even if updating strike count fails
        log.error(
          { err: error, modEventId: modEvent.id },
          'Error processing strikes for moderation event',
        )
      }
    }

    return { event: modEvent, subjectStatus }
  }

  async purgeAgeAssuranceEvents(subjectDid: DidString) {
    this.db.assertTransaction()
    await this.db.db
      .deleteFrom('moderation_event')
      .where('subjectDid', '=', subjectDid)
      .where('action', '=', tools.ozone.moderation.defs.ageAssuranceEvent.$type)
      .execute()
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
        `%${subject.subject.recordPath}%` as any,
      )
    }

    // Means the subject was suspended and needs to be unsuspended
    if (subject.reverseSuspend) {
      builder = builder
        .where(
          'action',
          '=',
          tools.ozone.moderation.defs.modEventTakedown.$type,
        )
        .where('durationInHours', 'is not', null)
    }
    if (subject.reverseMute) {
      builder = builder
        .where('action', '=', tools.ozone.moderation.defs.modEventMute.$type)
        .where('durationInHours', 'is not', null)
    }

    return await builder
      .orderBy('id', 'desc')
      .selectAll()
      .limit(1)
      .executeTakeFirst()
  }

  async getSubjectsDueForReversal(): Promise<ReversalSubject[]> {
    const now = currentDatetimeString()
    const subjects = await this.db.db
      .selectFrom('moderation_subject_status')
      .where((eb) =>
        eb.or([eb('suspendUntil', '<', now), eb('muteUntil', '<', now)]),
      )
      .selectAll()
      .execute()

    return subjects.map((row) => ({
      subject: subjectFromStatusRow(row),
      reverseSuspend: !!row.suspendUntil && row.suspendUntil < now,
      reverseMute: !!row.muteUntil && row.muteUntil < now,
    }))
  }

  async isSubjectSuspended(did: DidString): Promise<boolean> {
    const res = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .where('suspendUntil', '>', currentDatetimeString())
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
      action === tools.ozone.moderation.defs.modEventTakedown.$type
    this.db.assertTransaction()
    const { event } = await this.logEvent({
      event: isRevertingTakedown
        ? tools.ozone.moderation.defs.modEventReverseTakedown.$build({
            comment: comment ?? undefined,
          })
        : tools.ozone.moderation.defs.modEventUnmute.$build({
            comment: comment ?? undefined,
          }),
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
    targetServices: Set<string>,
    isSuspend = false,
  ) {
    const takedownRef = `BSKY-${
      isSuspend ? 'SUSPEND' : 'TAKEDOWN'
    }-${takedownId}`

    const values = this.eventPusher
      .getTakedownServices(targetServices)
      .map((eventType) => ({
        eventType,
        subjectDid: subject.did,
        takedownRef,
      }))

    // The label is consumed by appview if we opt for appview only takedown, this is needed
    // if we opt for pds level takedown, adding the label doesn't hurt
    const takedownLabel = isSuspend ? SUSPEND_LABEL : TAKEDOWN_LABEL
    await this.formatAndCreateLabels(subject.did, null, {
      create: [takedownLabel],
    })

    // If we dont have to push any events, return early
    if (!values.length) {
      return
    }

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

  async takedownRecord(
    subject: RecordSubject,
    takedownId: number,
    targetServices: Set<string>,
  ) {
    this.db.assertTransaction()
    await this.formatAndCreateLabels(subject.uri, subject.cid, {
      create: [TAKEDOWN_LABEL],
    })

    const takedownRef = `BSKY-TAKEDOWN-${takedownId}`
    const blobCids = subject.blobCids
    if (blobCids && blobCids.length > 0) {
      const blobValues: Insertable<BlobPushEvent>[] = []
      for (const eventType of this.eventPusher.getTakedownServices(
        targetServices,
      )) {
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
                  log.error({ ...evt, err }, 'failed to push blob event'),
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
    reasonType: com.atproto.moderation.defs.ReasonType
    reason?: string
    subject: ModSubject
    reportedBy: DidString
    createdAt?: Date
    modTool?: NonNullable<ModerationEvent['modTool']>
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
      modTool,
    } = info

    return await this.logEvent({
      event: tools.ozone.moderation.defs.modEventReport.$build({
        reportType: reasonType,
        comment: reason,
      }),
      createdBy: reportedBy,
      subject,
      createdAt,
      modTool,
    })
  }

  async getSubjectStatuses({
    queueCount,
    queueIndex,
    queueSeed = '',
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
    includeMuted = false,
    hostingDeletedBefore,
    hostingDeletedAfter,
    hostingUpdatedBefore,
    hostingUpdatedAfter,
    hostingStatuses,
    onlyMuted = false,
    ignoreSubjects,
    sortDirection = 'desc',
    lastReviewedBy,
    sortField = 'lastReportedAt',
    subject,
    tags,
    excludeTags,
    collections,
    subjectType,
    minAccountSuspendCount,
    minReportedRecordsCount,
    minTakendownRecordsCount,
    minPriorityScore,
    minStrikeCount,
    ageAssuranceState,
  }: tools.ozone.moderation.queryStatuses.$Params): Promise<{
    statuses: ModerationSubjectStatusRowWithHandle[]
    cursor?: string
  }> {
    let builder = moderationSubjectStatusQueryBuilder(this.db.db)

    const { ref } = this.db.db.dynamic

    if (subject) {
      const subjectInfo = getStatusIdentifierFromSubject(subject)
      builder = builder.where(
        'moderation_subject_status.did',
        '=',
        subjectInfo.did,
      )

      if (!includeAllUserRecords) {
        if (subjectInfo.convoId) {
          builder = builder.where(
            'moderation_subject_status.convoId',
            '=',
            subjectInfo.convoId,
          )
        } else if (subjectInfo.recordPath) {
          builder = builder.where(
            'moderation_subject_status.recordPath',
            '=',
            subjectInfo.recordPath,
          )
        } else {
          // Account-level: recordPath = '' also matches conversation statuses,
          // so explicitly exclude them.
          builder = builder
            .where('moderation_subject_status.recordPath', '=', '')
            .where('moderation_subject_status.convoId', '=', '')
        }
      }
    } else if (subjectType === 'account') {
      builder = builder
        .where('moderation_subject_status.recordPath', '=', '')
        .where('moderation_subject_status.convoId', '=', '')
    } else if (subjectType === 'record') {
      builder = builder.where('moderation_subject_status.recordPath', '!=', '')
    } else if (subjectType === 'conversation') {
      builder = builder.where('moderation_subject_status.convoId', '!=', '')
    }

    // Only fetch items that belongs to the specified queue when specified
    if (
      !subject &&
      queueCount &&
      queueCount > 0 &&
      queueIndex !== undefined &&
      queueIndex >= 0 &&
      queueIndex < queueCount
    ) {
      builder = builder.where(
        queueSeed
          ? sql`ABS(HASHTEXT(${queueSeed} || moderation_subject_status.did)) % ${queueCount}`
          : sql`ABS(HASHTEXT(moderation_subject_status.did)) % ${queueCount}`,
        '=',
        queueIndex,
      )
    }

    // If subjectType is set to 'account' let that take priority and ignore collections filter
    if (subjectType !== 'account' && collections?.length) {
      builder = builder
        .where('moderation_subject_status.recordPath', '!=', '')
        .where((eb) =>
          eb.or(
            collections.map((collection) =>
              eb(
                'moderation_subject_status.recordPath',
                'like',
                `${collection}/%`,
              ),
            ),
          ),
        )
    }

    const ignoredDids = ignoreSubjects?.filter(isDidString)
    if (ignoredDids?.length) {
      builder = builder.where(
        'moderation_subject_status.did',
        'not in',
        ignoredDids,
      )
    }

    const ignoredRecordPaths = ignoreSubjects?.filter((r) => !isDidString(r))
    if (ignoredRecordPaths?.length) {
      builder = builder.where(
        'moderation_subject_status.recordPath',
        'not in',
        ignoredRecordPaths,
      )
    }

    const reviewStateNormalized = getReviewState(reviewState)
    if (reviewStateNormalized) {
      builder = builder.where(
        'moderation_subject_status.reviewState',
        '=',
        reviewStateNormalized,
      )
    }

    if (lastReviewedBy) {
      builder = builder.where(
        'moderation_subject_status.lastReviewedBy',
        '=',
        lastReviewedBy,
      )
    }

    if (reviewedAfter) {
      builder = builder.where(
        'moderation_subject_status.lastReviewedAt',
        '>',
        reviewedAfter,
      )
    }

    if (reviewedBefore) {
      builder = builder.where(
        'moderation_subject_status.lastReviewedAt',
        '<',
        reviewedBefore,
      )
    }

    if (hostingUpdatedAfter) {
      builder = builder.where(
        'moderation_subject_status.hostingUpdatedAt',
        '>',
        hostingUpdatedAfter,
      )
    }

    if (hostingUpdatedBefore) {
      builder = builder.where(
        'moderation_subject_status.hostingUpdatedAt',
        '<',
        hostingUpdatedBefore,
      )
    }

    if (hostingDeletedAfter) {
      builder = builder.where(
        'moderation_subject_status.hostingDeletedAt',
        '>',
        hostingDeletedAfter,
      )
    }

    if (hostingDeletedBefore) {
      builder = builder.where(
        'moderation_subject_status.hostingDeletedAt',
        '<',
        hostingDeletedBefore,
      )
    }

    if (hostingStatuses?.length) {
      builder = builder.where(
        'moderation_subject_status.hostingStatus',
        'in',
        hostingStatuses,
      )
    }

    if (reportedAfter) {
      builder = builder.where(
        'moderation_subject_status.lastReviewedAt',
        '>',
        reportedAfter,
      )
    }

    if (reportedBefore) {
      builder = builder.where(
        'moderation_subject_status.lastReportedAt',
        '<',
        reportedBefore,
      )
    }

    if (takendown) {
      builder = builder.where('moderation_subject_status.takendown', '=', true)
    }

    if (appealed !== undefined) {
      builder =
        appealed === false
          ? builder.where('moderation_subject_status.appealed', 'is', null)
          : builder.where('moderation_subject_status.appealed', '=', appealed)
    }

    if (!includeMuted) {
      builder = builder.where((eb) =>
        eb.or([
          eb(
            'moderation_subject_status.muteUntil',
            '<',
            currentDatetimeString(),
          ),
          eb('moderation_subject_status.muteUntil', 'is', null),
        ]),
      )
    }

    if (onlyMuted) {
      builder = builder.where((eb) =>
        eb.or([
          eb(
            'moderation_subject_status.muteUntil',
            '>',
            currentDatetimeString(),
          ),
          eb(
            'moderation_subject_status.muteReportingUntil',
            '>',
            currentDatetimeString(),
          ),
        ]),
      )
    }

    // ["tag1", "tag2 && tag3", "tag4"] => [["tag1"], ["tag2", "tag3"], ["tag4"]]
    const conditions = parseTags(tags)
    if (conditions?.length) {
      // [["tag1"], ["tag2", "tag3"], ["tag4"]] => (tags ? 'tag1') OR (tags ? 'tag2' AND tags ? 'tag3') OR (tags ? 'tag4')
      builder = builder.where((eb) =>
        // OR between every conditions items (subTags)
        eb.or(
          conditions.map((subTags) =>
            // AND between every subTags items (subTag)
            eb.and(
              subTags.map(
                (subTag) =>
                  sql<boolean>`${ref('moderation_subject_status.tags')} ? ${subTag}`,
              ),
            ),
          ),
        ),
      )
    }

    if (excludeTags?.length) {
      builder = builder.where((eb) =>
        eb.or([
          sql<boolean>`NOT(${ref('moderation_subject_status.tags')} ?| array[${sql.join(excludeTags)}]::TEXT[])`,
          eb('tags', 'is', null),
        ]),
      )
    }

    if (minAccountSuspendCount != null && minAccountSuspendCount > 0) {
      builder = builder.where(
        'account_events_stats.suspendCount',
        '>=',
        minAccountSuspendCount,
      )
    }

    if (minTakendownRecordsCount != null && minTakendownRecordsCount > 0) {
      builder = builder.where(
        'account_record_status_stats.takendownCount',
        '>=',
        minTakendownRecordsCount,
      )
    }

    if (minReportedRecordsCount != null && minReportedRecordsCount > 0) {
      builder = builder.where(
        'account_record_events_stats.reportedCount',
        '>=',
        minReportedRecordsCount,
      )
    }

    if (minPriorityScore != null && minPriorityScore >= 0) {
      builder = builder.where(
        'moderation_subject_status.priorityScore',
        '>=',
        minPriorityScore,
      )
    }

    if (minStrikeCount != null && minStrikeCount >= 0) {
      builder = builder.where(
        'account_strike.activeStrikeCount',
        '>=',
        minStrikeCount,
      )
    }

    if (ageAssuranceState) {
      builder = builder.where(
        'moderation_subject_status.ageAssuranceState',
        '=',
        ageAssuranceState,
      )
    }

    const keyset = new StatusKeyset(
      sortField === 'reportedRecordsCount'
        ? ref(`account_record_events_stats.reportedCount`)
        : sortField === 'takendownRecordsCount'
          ? ref(`account_record_status_stats.takendownCount`)
          : sortField === 'priorityScore'
            ? ref(`moderation_subject_status.priorityScore`)
            : ref(`moderation_subject_status.${sortField}`),
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

    return {
      statuses: results.map((r) => ({
        ...r,
        handle: infos.get(r.did)?.handle ?? INVALID_HANDLE,
      })),
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
      .where('convoId', '=', subject.convoId ?? '')
      .selectAll()
      .executeTakeFirst()
    return result ?? null
  }

  // This is used to check if the reporter of an incoming report is muted from reporting
  // so we want to make sure this look up is as fast as possible
  async isReportingMutedForSubject(did: DidString) {
    const result = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .where('muteReportingUntil', '>', currentDatetimeString())
      .select(sql`true`.as('status'))
      .executeTakeFirst()

    return !!result
  }

  // Check if a subject (the account being reported) has an active mute
  async isSubjectMuted(did: DidString) {
    const result = await this.db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .where('muteUntil', '>', currentDatetimeString())
      .select(sql`true`.as('status'))
      .executeTakeFirst()

    return !!result
  }

  async formatAndCreateLabels(
    uri: UriString,
    cid: string | null,
    labels: { create?: string[]; negate?: string[] },
    durationInHours?: number,
  ): Promise<com.atproto.label.defs.Label[]> {
    const exp =
      durationInHours !== undefined
        ? toDatetimeString(addHoursToDate(durationInHours))
        : undefined
    const { create = [], negate = [] } = labels
    const toCreate = create.map((val) => ({
      src: this.cfg.service.did,
      uri,
      cid: cid ?? undefined,
      val,
      exp,
      cts: currentDatetimeString(),
    }))
    const toNegate = negate.map((val) => ({
      src: this.cfg.service.did,
      uri,
      cid: cid ?? undefined,
      val,
      neg: true,
      cts: currentDatetimeString(),
    }))
    const formatted = [...toCreate, ...toNegate]
    return this.createLabels(formatted)
  }

  async createLabels(
    labels: com.atproto.label.defs.Label[],
  ): Promise<com.atproto.label.defs.Label[]> {
    if (labels.length < 1) return []
    const signedLabels = await Promise.all(
      labels.map((l) => signLabel(l, this.signingKey)),
    )
    const dbVals = signedLabels.map((l) => formatLabelRow(l, this.signingKeyId))
    const { ref } = this.db.db.dynamic
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
    await sql`notify ${ref(LabelChannel)}`.execute(this.db.db)
    return res.map((row) => formatLabel(row))
  }

  async sendEmail(opts: {
    content: string
    recipientDid: DidString
    subject: string
  }) {
    const { subject, content, recipientDid } = opts
    const { client: pdsClient, url } = await getPdsClientForRepo(
      this.idResolver,
      recipientDid,
      this.cfg.service.devMode,
    )
    if (!pdsClient) {
      throw new InvalidRequestError('Invalid pds service in DID doc')
    }
    const serverInfo = await pdsClient.call(com.atproto.server.describeServer)
    if (serverInfo.did !== `did:web:${url.hostname}`) {
      // @TODO do bidirectional check once implemented. in the meantime,
      // matching did to hostname we're talking to is pretty good.
      throw new InvalidRequestError('Invalid pds service in DID doc')
    }
    const delivery = await pdsClient.call(
      com.atproto.admin.sendEmail,
      {
        subject,
        content,
        recipientDid,
        senderDid: this.cfg.service.did,
      },
      await this.createAuthHeaders(
        serverInfo.did,
        com.atproto.admin.sendEmail.$lxm,
      ),
    )
    if (!delivery.sent) {
      throw new InvalidRequestError('Email was accepted but not sent')
    }
  }

  async buildModerationQuery(
    subjectType: 'account' | 'record',
    createdByDids: DidString[] | undefined,
    isActionQuery: boolean,
  ): Promise<(Partial<ReporterStatsResult> & { did: DidString })[]> {
    if (!createdByDids?.length) return []

    const actionTypes = [
      tools.ozone.moderation.defs.modEventTakedown.$type,
      tools.ozone.moderation.defs.modEventLabel.$type,
    ] as const

    const countAll = () => {
      return sql<number>`COUNT(*)`
    }
    const countAllDistinctBy = (ref: Expression<unknown>) => {
      return sql<number>`COUNT(DISTINCT ${ref})`
    }
    const countTakedownsDistinctBy = (ref: Expression<unknown>) => {
      return sql<number>`COUNT(DISTINCT ${ref}) FILTER (
        WHERE actions."action" = ${tools.ozone.moderation.defs.modEventTakedown.$type}
      )`
    }
    const countLabelsDistinctBy = (ref: Expression<unknown>) => {
      return sql<number>`COUNT(DISTINCT ${ref}) FILTER (
        WHERE actions."action" = ${tools.ozone.moderation.defs.modEventLabel.$type}
      )`
    }

    const query = this.db.db
      .selectFrom('moderation_event as reports')
      .where(
        'reports.action',
        '=',
        tools.ozone.moderation.defs.modEventReport.$type,
      )
      .where(
        'reports.subjectUri',
        subjectType === 'account' ? 'is' : 'is not',
        null,
      )
      .where('reports.createdBy', 'in', createdByDids)
      .select(['reports.createdBy as did'])

    if (!isActionQuery) {
      if (subjectType === 'account') {
        return query
          .select([
            () => countAll().as('accountReportCount'),
            (eb) =>
              countAllDistinctBy(eb.ref('reports.subjectDid')).as(
                'reportedAccountCount',
              ),
          ])
          .groupBy('reports.createdBy')
          .execute()
      } else {
        return query
          .select([
            () => countAll().as('recordReportCount'),
            (eb) =>
              countAllDistinctBy(eb.ref('reports.subjectUri')).as(
                'reportedRecordCount',
              ),
          ])
          .groupBy('reports.createdBy')
          .execute()
      }
    }

    if (subjectType === 'account') {
      return query
        .leftJoin('moderation_event as actions', (join) =>
          join
            .onRef('actions.subjectDid', '=', 'reports.subjectDid')
            .on('actions.subjectUri', 'is', null)
            .onRef('actions.createdAt', '>', 'reports.createdAt')
            .on('actions.action', 'in', actionTypes),
        )
        .select([
          (eb) =>
            countTakedownsDistinctBy(eb.ref('actions.subjectDid')).as(
              'takendownAccountCount',
            ),
          (eb) =>
            countLabelsDistinctBy(eb.ref('actions.subjectDid')).as(
              'labeledAccountCount',
            ),
        ])
        .groupBy('reports.createdBy')
        .execute()
    } else {
      return query
        .leftJoin('moderation_event as actions', (join) =>
          join
            .onRef('actions.subjectDid', '=', 'reports.subjectDid')
            .onRef('actions.subjectUri', '=', 'reports.subjectUri')
            .onRef('actions.createdAt', '>', 'reports.createdAt')
            .on('actions.action', 'in', actionTypes),
        )
        .select([
          (eb) =>
            countTakedownsDistinctBy(eb.ref('actions.subjectUri')).as(
              'takendownRecordCount',
            ),
          (eb) =>
            countLabelsDistinctBy(eb.ref('actions.subjectUri')).as(
              'labeledRecordCount',
            ),
        ])
        .groupBy('reports.createdBy')
        .execute()
    }
  }

  async getReporterStats(dids?: DidString[]) {
    const [accountReports, recordReports, accountActions, recordActions] =
      await Promise.all([
        this.buildModerationQuery('account', dids, false),
        this.buildModerationQuery('record', dids, false),
        this.buildModerationQuery('account', dids, true),
        this.buildModerationQuery('record', dids, true),
      ])

    // Create a map to hold the aggregated stats for each `did`
    const statsMap = new Map<string, ReporterStats>()

    // Helper function to ensure a `did` entry exists in the map
    const ensureDidEntry = (did: DidString) => {
      if (!statsMap.has(did)) {
        statsMap.set(did, {
          did,
          accountReportCount: 0,
          recordReportCount: 0,
          reportedAccountCount: 0,
          reportedRecordCount: 0,
          takendownAccountCount: 0,
          takendownRecordCount: 0,
          labeledAccountCount: 0,
          labeledRecordCount: 0,
        })
      }
      return statsMap.get(did)!
    }

    // Merge accountReports
    for (const report of accountReports) {
      const entry = ensureDidEntry(report.did)
      entry.accountReportCount = report.accountReportCount ?? 0
      entry.reportedAccountCount = report.reportedAccountCount ?? 0
    }

    // Merge recordReports
    for (const report of recordReports) {
      const entry = ensureDidEntry(report.did)
      entry.recordReportCount = report.recordReportCount ?? 0
      entry.reportedRecordCount = report.reportedRecordCount ?? 0
    }

    // Merge accountActions
    for (const action of accountActions) {
      const entry = ensureDidEntry(action.did)
      entry.takendownAccountCount = action.takendownAccountCount ?? 0
      entry.labeledAccountCount = action.labeledAccountCount ?? 0
    }

    // Merge recordActions
    for (const action of recordActions) {
      const entry = ensureDidEntry(action.did)
      entry.takendownRecordCount = action.takendownRecordCount ?? 0
      entry.labeledRecordCount = action.labeledRecordCount ?? 0
    }

    // Convert map values to an array and return
    return Array.from(statsMap.values())
  }

  async getAccountTimeline(did: DidString) {
    const { ref } = this.db.db.dynamic
    // Without the subquery approach, pg tries to do the sort operation first which can be super expensive when a subjectDid has too many entries
    const result = await this.db.db
      .selectFrom(
        this.db.db
          .selectFrom('moderation_event')
          .where('subjectDid', '=', did)
          .select([
            dateFromDbDatetime(ref('createdAt')).as('day'),
            'subjectUri',
            'action',
            sql<number>`count(*)`.as('count'),
          ])
          .groupBy(['day', 'subjectUri', 'action'])
          .as('results'),
      )
      .selectAll()
      .orderBy('day', 'desc')
      .execute()
    return result
  }
}

const parseTags = (tags?: string[]) =>
  tags
    ?.map((tag) =>
      tag
        .split(/\s*&&\s*/g)
        .map((subTag) => subTag.trim())
        // Ignore invalid syntax ("", "tag1 &&", "&& tag2", "tag1 && && tag2", etc.)
        .filter(Boolean),
    )
    // Ignore invalid items
    .filter((subTags): subTags is [string, ...string[]] => subTags.length > 0)

const TAKEDOWNS = ['pds_takedown' as const, 'appview_takedown' as const]

export const TAKEDOWN_LABEL = '!takedown'
export const SUSPEND_LABEL = '!suspend'

export type TakedownSubjects = {
  did: DidString
  subjects: (
    | com.atproto.admin.defs.RepoRef
    | com.atproto.admin.defs.RepoBlobRef
    | com.atproto.repo.strongRef.Main
  )[]
}

export type ReversalSubject = {
  subject: ModSubject
  reverseSuspend: boolean
  reverseMute: boolean
}
