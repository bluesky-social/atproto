import { sql } from 'kysely'
import { chunkArray, dedupeStrs } from '@atproto/common'
import type { Keypair } from '@atproto/crypto'
import type { IdResolver } from '@atproto/identity'
import {
  type AtIdentifierString,
  type AtUriString,
  type BlobRef,
  type Client,
  type DatetimeString,
  type DidString,
  type HandleString,
  type LexMap,
  type NsidString,
  type Un$Typed,
  type UriString,
  currentDatetimeString,
  getBlobCidString,
  getBlobMime,
  getBlobSize,
  isBlobRef,
  isDatetimeString,
  isDidString,
  isHandleString,
  toDatetimeString,
} from '@atproto/lex'
import { AtUri, INVALID_HANDLE, normalizeDatetimeAlways } from '@atproto/syntax'
import type { Database } from '../db/index.js'
import type { LabelRow } from '../db/schema/label.js'
import { app, com, tools } from '../lexicons/index.js'
import { dbLogger, httpLogger } from '../logger.js'
import type { ParsedLabelers } from '../util.js'
import {
  getStatusIdentifierFromSubject,
  moderationSubjectStatusQueryBuilder,
} from './status.js'
import {
  CHAT_CONVO_COLLECTION,
  type ModSubject,
  subjectFromEventRow,
  subjectFromStatusRow,
} from './subject.js'
import type {
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRowWithHandle,
} from './types.js'
import { formatLabel, getPdsClientForRepo, signLabel } from './util.js'

const isValidSelfLabels = com.atproto.label.defs.selfLabels.$matches

const ifString = (val: unknown): string | undefined =>
  typeof val === 'string' ? val : undefined
const ifBoolean = (val: unknown): boolean | undefined =>
  typeof val === 'boolean' ? val : undefined
const ifNumber = (val: unknown): number | undefined =>
  typeof val === 'number' ? val : undefined
// `meta` is a free-form jsonb column, so these narrow to the branded scalar the
// lexicon field expects rather than a bare string.
const ifDatetime = (val: unknown): DatetimeString | undefined =>
  isDatetimeString(val) ? val : undefined
const ifHandle = (val: unknown): HandleString | undefined =>
  isHandleString(val) ? val : undefined

export type AuthHeaders = {
  headers: {
    authorization: string
    'atproto-accept-labelers'?: string
  }
}

export class ModerationViews {
  constructor(
    private db: Database,
    private signingKey: Keypair,
    private signingKeyId: number,
    private appviewClient: Client,
    private appviewAuth: (method: string) => Promise<AuthHeaders>,
    public idResolver: IdResolver,
    public devMode?: boolean,
  ) {}

  async getAccoutInfosByDid(
    dids: DidString[],
  ): Promise<Map<string, com.atproto.admin.defs.AccountView>> {
    if (dids.length === 0) return new Map()
    const auth = await this.appviewAuth(com.atproto.admin.getAccountInfos.$lxm)
    if (!auth) return new Map()
    try {
      const body = await this.appviewClient.call(
        com.atproto.admin.getAccountInfos,
        { dids: dedupeStrs(dids) },
        auth,
      )
      return body.infos.reduce((acc, cur) => {
        return acc.set(cur.did, cur)
      }, new Map<string, com.atproto.admin.defs.AccountView>())
    } catch (err) {
      httpLogger.error(
        { err, dids },
        'failed to resolve account infos from appview',
      )
      return new Map()
    }
  }

  async repos(
    dids: DidString[],
  ): Promise<Map<string, tools.ozone.moderation.defs.RepoView>> {
    if (dids.length === 0) return new Map()
    const [infos, subjectStatuses] = await Promise.all([
      this.getAccoutInfosByDid(dids),
      this.getSubjectStatus(dids),
    ])

    return dids.reduce((acc, did) => {
      const info = infos.get(did)
      if (!info) return acc
      const status = subjectStatuses.get(did)
      return acc.set(did, {
        // No email or invite info on appview
        did,
        handle: info.handle,
        relatedRecords: info.relatedRecords ?? [],
        indexedAt: info.indexedAt,
        moderation: {
          subjectStatus: status ? this.formatSubjectStatus(status) : undefined,
        },
      })
    }, new Map<string, tools.ozone.moderation.defs.RepoView>())
  }

  formatEvent(
    row: ModerationEventRowWithHandle,
  ): Un$Typed<tools.ozone.moderation.defs.ModEventView> {
    const eventView: Un$Typed<tools.ozone.moderation.defs.ModEventView> = {
      id: row.id,
      event: {
        $type: row.action,
        comment: row.comment ?? undefined,
      } as tools.ozone.moderation.defs.ModEventView['event'],
      subject: subjectFromEventRow(row).lex(),
      subjectBlobCids: row.subjectBlobCids ?? [],
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      subjectHandle: row.subjectHandle ?? undefined,
      creatorHandle: row.creatorHandle ?? undefined,
      modTool: row.modTool
        ? {
            name: row.modTool.name,
            meta: sanitizeUnsafeIntegers(row.modTool.meta) as
              LexMap | undefined,
          }
        : undefined,
    }

    const { event } = eventView
    const meta = row.meta || {}

    if (
      tools.ozone.moderation.defs.modEventMuteReporter.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventLabel.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventMute.$isTypeOf(event)
    ) {
      event.durationInHours = row.durationInHours ?? undefined
    }

    if (
      (tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
        tools.ozone.moderation.defs.modEventAcknowledge.$isTypeOf(event)) &&
      meta.acknowledgeAccountSubjects
    ) {
      event.acknowledgeAccountSubjects = ifBoolean(
        meta.acknowledgeAccountSubjects,
      )!
    }

    if (tools.ozone.moderation.defs.modEventPriorityScore.$isTypeOf(event)) {
      event.score = ifNumber(meta?.priorityScore) ?? 0
    }

    if (
      tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventEmail.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventReverseTakedown.$isTypeOf(event)
    ) {
      if (typeof meta.policies === 'string' && meta.policies.length > 0) {
        event.policies = meta.policies.split(',')
      }

      event.strikeCount = ifNumber(row.strikeCount)
      event.severityLevel = ifString(row.severityLevel)

      if (
        tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
        tools.ozone.moderation.defs.modEventEmail.$isTypeOf(event)
      ) {
        event.strikeExpiresAt = ifDatetime(row.strikeExpiresAt)
      }
    }

    if (tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event)) {
      if (
        typeof meta.targetServices === 'string' &&
        meta.targetServices.length > 0
      ) {
        event.targetServices = meta.targetServices.split(',')
      }
    }

    if (tools.ozone.moderation.defs.modEventLabel.$isTypeOf(event)) {
      event.createLabelVals = row.createLabelVals?.length
        ? row.createLabelVals.split(' ')
        : []
      event.negateLabelVals = row.negateLabelVals?.length
        ? row.negateLabelVals.split(' ')
        : []
    } else if (
      tools.ozone.moderation.defs.modEventAcknowledge.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventEscalate.$isTypeOf(event)
    ) {
      // This is for legacy data only, for new events, these types of events
      // won't have labels attached:

      if (row.createLabelVals?.length) {
        // @ts-expect-error legacy
        event.createLabelVals = row.createLabelVals.split(' ')
      }

      if (row.negateLabelVals?.length) {
        // @ts-expect-error legacy
        event.negateLabelVals = row.negateLabelVals.split(' ')
      }
    }

    if (tools.ozone.moderation.defs.modEventReport.$isTypeOf(event)) {
      event.isReporterMuted = !!meta.isReporterMuted
      event.reportType = ifString(meta.reportType)!
    }

    if (tools.ozone.moderation.defs.modEventEmail.$isTypeOf(event)) {
      event.content = ifString(meta.content)!
      event.subjectLine = ifString(meta.subjectLine)!
      event.isDelivered = ifBoolean(meta.isDelivered)
    }

    if (
      tools.ozone.moderation.defs.modEventComment.$isTypeOf(event) &&
      meta.sticky
    ) {
      event.sticky = true
    }

    if (tools.ozone.moderation.defs.modEventTag.$isTypeOf(event)) {
      event.add = row.addedTags || []
      event.remove = row.removedTags || []
    }

    if (tools.ozone.moderation.defs.accountEvent.$isTypeOf(event)) {
      event.active = !!meta.active
      event.timestamp = ifDatetime(meta.timestamp)!
      event.status = ifString(meta.status)!
    }

    if (tools.ozone.moderation.defs.identityEvent.$isTypeOf(event)) {
      event.timestamp = ifDatetime(meta.timestamp)!
      event.handle = ifHandle(meta.handle)!
      event.pdsHost = ifString(meta.pdsHost)! as `${string}:${string}`
      event.tombstone = !!meta.tombstone
    }

    if (tools.ozone.moderation.defs.recordEvent.$isTypeOf(event)) {
      event.op = ifString(meta.op)!
      event.cid = ifString(meta.cid)!
      event.timestamp = ifDatetime(meta.timestamp)!
    }

    if (tools.ozone.moderation.defs.ageAssuranceEvent.$isTypeOf(event)) {
      event.status = ifString(meta.status)!
      event.access = ifString(meta.access)!
      event.createdAt = ifString(meta.createdAt)! as DatetimeString
      event.attemptId = ifString(meta.attemptId)!
      event.initIp = ifString(meta.initIp)
      event.initUa = ifString(meta.initUa)
      event.completeIp = ifString(meta.completeIp)
      event.completeUa = ifString(meta.completeUa)
    }

    if (
      tools.ozone.moderation.defs.ageAssuranceOverrideEvent.$isTypeOf(event)
    ) {
      event.status = ifString(meta.status)!
      event.access = ifString(meta.access)!
    }

    if (tools.ozone.moderation.defs.scheduleTakedownEvent.$isTypeOf(event)) {
      event.executeAt = ifDatetime(meta.executeAt)
      event.executeAfter = ifDatetime(meta.executeAfter)
      event.executeUntil = ifDatetime(meta.executeUntil)
    }

    return eventView
  }

  async eventDetail(
    result: ModerationEventRowWithHandle,
  ): Promise<tools.ozone.moderation.defs.ModEventViewDetail> {
    const modSubject = subjectFromEventRow(result)
    const subject = await this.subject(modSubject)
    const eventView = this.formatEvent(result)
    const allBlobs = 'value' in subject ? findBlobRefs(subject.value) : []
    const subjectBlobs = await this.blob(
      allBlobs.filter((blob) =>
        eventView.subjectBlobCids.includes(getBlobCidString(blob)),
      ),
    )
    return {
      ...eventView,
      subject,
      subjectBlobs,
    }
  }

  async repoDetails(
    dids: DidString[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, tools.ozone.moderation.defs.RepoView>> {
    const results = new Map<string, tools.ozone.moderation.defs.RepoView>()
    if (!dids.length) {
      return results
    }

    const [repos, localLabels, externalLabels] = await Promise.all([
      this.repos(dids),
      this.labels(dids),
      this.getExternalLabels(dids, labelers),
    ])

    repos.forEach((repo, did) => {
      const labels = [
        ...(localLabels.get(did) || []),
        ...(externalLabels.get(did) || []),
      ]
      const repoView = {
        ...repo,
        labels,
        moderation: {
          ...repo.moderation,
        },
      }
      results.set(did, repoView)
    })

    return results
  }

  async fetchRecord(
    params: com.atproto.repo.getRecord.$Params,
    appviewAuth: AuthHeaders,
  ) {
    const res = await this.appviewClient.xrpcSafe(com.atproto.repo.getRecord, {
      params,
      ...appviewAuth,
    })
    if (res.success) return res.body
    if (res.error !== 'RecordNotFound') return null
    // @NOTE we only support dids (lexicon defines AtIdentifierString)
    if (!isDidString(params.repo)) return null

    // Fall back to the repo's PDS. If that fetch fails, return null regardless
    // of the error.
    try {
      const { client: pdsClient } = await getPdsClientForRepo(
        this.idResolver,
        params.repo,
        this.devMode,
      )
      if (!pdsClient) {
        return null
      }

      return await pdsClient.call(com.atproto.repo.getRecord, params)
    } catch (error) {
      return null
    }
  }

  async fetchRecords(
    subjects: RecordSubject[],
  ): Promise<Map<string, RecordInfo>> {
    const appviewAuth = await this.appviewAuth(com.atproto.repo.getRecord.$lxm)
    if (!appviewAuth) return new Map()

    const fetched = await Promise.all(
      subjects.map(async (subject) => {
        const uri = new AtUri(subject.uri)
        const params = {
          repo: uri.hostname as AtIdentifierString,
          collection: uri.collection as NsidString,
          rkey: uri.rkey,
          cid: subject.cid,
        }
        return this.fetchRecord(params, appviewAuth)
      }),
    )
    return fetched.reduce((acc, cur) => {
      if (!cur) return acc
      const indexedAt = currentDatetimeString()
      return acc.set(cur.uri, { ...cur, cid: cur.cid ?? '', indexedAt })
    }, new Map<string, RecordInfo>())
  }

  async records(subjects: RecordSubject[]) {
    const uris = subjects.map((record) => new AtUri(record.uri))
    const dids = uris.map((u) => u.did)

    const [repos, subjectStatuses, records] = await Promise.all([
      this.repos(dids),
      this.getSubjectStatus(subjects.map((s) => s.uri)),
      this.fetchRecords(subjects),
    ])

    const map = new Map<
      string,
      // Because the result of this function is used to build tools.ozone.moderation.defs.RecordViewDetail,
      // we explicitly type the result without the $type field, so can be used
      // as both tools.ozone.moderation.defs.RecordView and tools.ozone.moderation.defs.RecordViewDetail, without having to cast or
      // override the $type field.
      tools.ozone.moderation.defs.RecordView & {
        $type?: undefined
        moderation: {
          $type?: undefined
          subjectStatus?: tools.ozone.moderation.defs.SubjectStatusView
        }
      }
    >()

    for (const uri of uris) {
      const repo = repos.get(uri.hostname)
      if (!repo) continue
      const record = records.get(uri.toString())
      if (!record) continue
      const subjectStatus = subjectStatuses.get(uri.toString())

      map.set(uri.toString(), {
        uri: uri.toString(),
        cid: record.cid,
        value: record.value as LexMap,
        blobCids: findBlobRefs(record.value).map((b) => getBlobCidString(b)),
        indexedAt: record.indexedAt,
        repo,
        moderation: {
          subjectStatus: subjectStatus
            ? this.formatSubjectStatus(subjectStatus)
            : undefined,
        },
      })
    }

    return map
  }

  async recordDetails(
    subjects: RecordSubject[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, tools.ozone.moderation.defs.RecordViewDetail>> {
    const results = new Map<
      string,
      tools.ozone.moderation.defs.RecordViewDetail
    >()
    if (!subjects.length) {
      return results
    }

    const subjectUris = subjects.map((s) => s.uri)
    const [records, subjectStatusesResult, localLabels, externalLabels] =
      await Promise.all([
        this.records(subjects),
        this.getSubjectStatus(subjectUris),
        this.labels(subjectUris),
        this.getExternalLabels(subjectUris, labelers),
      ])

    await Promise.all(
      Array.from(records.entries()).map(async ([uri, record]) => {
        const selfLabels = getSelfLabels({
          uri: record.uri,
          cid: record.cid,
          record: record.value,
        })

        const status = subjectStatusesResult.get(uri)
        const blobs = await this.blob(findBlobRefs(record.value))

        results.set(uri, {
          ...record,
          blobs,
          moderation: {
            ...record.moderation,
            subjectStatus: status
              ? this.formatSubjectStatus(status)
              : undefined,
          },
          labels: [
            ...(localLabels.get(uri) || []),
            ...selfLabels,
            ...(externalLabels.get(uri) || []),
          ],
        })
      }),
    )

    return results
  }

  async getExternalLabels(
    subjects: string[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, com.atproto.label.defs.Label[]>> {
    const results = new Map<string, com.atproto.label.defs.Label[]>()
    if (!labelers?.dids.length && !labelers?.redact.size) return results
    try {
      const { labels } = await this.appviewClient.call(
        com.atproto.label.queryLabels,
        { uriPatterns: subjects, sources: labelers.dids },
      )
      labels.forEach((label) => {
        if (!results.has(label.uri)) {
          results.set(label.uri, [label])
          return
        }
        results.get(label.uri)?.push(label)
      })
      return results
    } catch (err) {
      httpLogger.error(
        { err, subjects, labelers },
        'failed to resolve labels from appview',
      )
      return results
    }
  }

  formatReport(
    report: ModerationEventRowWithHandle,
  ): com.atproto.moderation.createReport.$OutputBody {
    return {
      id: report.id,
      createdAt: report.createdAt,
      // Ideally, we would never have a report entry that does not have a reasonType but at the schema level
      // we are not guarantying that so in whatever case, if we end up with such entries, default to 'other'
      reasonType: report.meta?.reportType
        ? (report.meta?.reportType as string)
        : com.atproto.moderation.defs.reasonOther.value,
      reason: report.comment ?? undefined,
      reportedBy: report.createdBy,
      subject: subjectFromEventRow(
        report,
      ).lex() as com.atproto.moderation.createReport.$OutputBody['subject'],
    }
  }
  // Partial view for subjects

  async subject(subject: ModSubject): Promise<SubjectView> {
    if (subject.isConvo()) {
      return tools.ozone.moderation.defs.convoView.$build({
        did: subject.did,
        convoId: subject.convoId,
      })
    } else if (subject.isRepo()) {
      const repos = await this.repos([subject.did])
      const repo = repos.get(subject.did)
      if (repo) {
        return tools.ozone.moderation.defs.repoView.$build(repo)
      } else {
        return tools.ozone.moderation.defs.repoViewNotFound.$build({
          did: subject.did,
        })
      }
    } else if (subject.isRecord()) {
      const uri = subject.uri
      const records = await this.records([{ uri }])
      const record = records.get(uri)
      if (record) {
        return tools.ozone.moderation.defs.recordView.$build(record)
      }
    }
    return tools.ozone.moderation.defs.repoViewNotFound.$build({
      did: subject.did,
    })
  }

  // Partial view for blobs

  async blob(
    blobs: BlobRef[],
  ): Promise<tools.ozone.moderation.defs.BlobView[]> {
    if (!blobs.length) return []
    const { ref } = this.db.db.dynamic
    const modStatusResults = await moderationSubjectStatusQueryBuilder(
      this.db.db,
    )
      .where(
        sql<boolean>`${ref(
          'moderation_subject_status.blobCids',
        )} @> ${JSON.stringify(blobs.map(getBlobCidString))}`,
      )
      .executeTakeFirst()

    const statusByCid = (modStatusResults?.blobCids || [])?.reduce(
      (acc, cur) => Object.assign(acc, { [cur]: modStatusResults }),
      {},
    )
    // Intentionally missing details field, since we don't have any on appview.
    // We also don't know when the blob was created, so we use a canned creation time.
    const unknownTime = toDatetimeString(0)
    return blobs.map((blob) => {
      const cid = getBlobCidString(blob)
      const subjectStatus = statusByCid[cid]
        ? this.formatSubjectStatus(statusByCid[cid])
        : undefined

      return {
        cid,
        mimeType: getBlobMime(blob),
        size: getBlobSize(blob) ?? 0,
        createdAt: unknownTime,
        moderation: {
          subjectStatus,
        },
      }
    })
  }

  async labels(
    subjects: UriString[],
    includeNeg?: boolean,
  ): Promise<Map<string, com.atproto.label.defs.Label[]>> {
    const now = currentDatetimeString()
    const labels = new Map<string, com.atproto.label.defs.Label[]>()
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', 'in', subjects)
      .where((eb) =>
        eb.or([eb('label.exp', 'is', null), eb('label.exp', '>', now)]),
      )
      .$if(!includeNeg, (qb) => qb.where('neg', '=', false))
      .selectAll()
      .execute()

    await Promise.all(
      res.map(async (labelRow) => {
        const signedLabel = await this.formatLabelAndEnsureSig(labelRow)

        const current = labels.get(labelRow.uri)
        if (current) current.push(signedLabel)
        else labels.set(labelRow.uri, [signedLabel])
      }),
    )
    return labels
  }

  async formatLabelAndEnsureSig(row: LabelRow) {
    const formatted = formatLabel(row)
    if (!!row.sig && row.signingKeyId === this.signingKeyId) {
      return formatted
    }
    const signed = await signLabel(formatted, this.signingKey)
    try {
      await this.db.db
        .updateTable('label')
        .set({ sig: Buffer.from(signed.sig), signingKeyId: this.signingKeyId })
        .where('id', '=', row.id)
        .execute()
    } catch (err) {
      dbLogger.error({ err, label: row }, 'failed to update resigned label')
    }
    return signed
  }

  async getSubjectStatus(
    subjects: (UriString | AtUri)[],
  ): Promise<Map<string, ModerationSubjectStatusRowWithHandle>> {
    if (!subjects.length) return new Map()

    const parsedSubjects = subjects.map((subject) =>
      getStatusIdentifierFromSubject(subject),
    )

    const builder = moderationSubjectStatusQueryBuilder(this.db.db)
      //
      .where((eb) =>
        eb.or(
          parsedSubjects.map((sub) =>
            eb.and([
              eb('moderation_subject_status.did', '=', sub.did),
              eb(
                'moderation_subject_status.recordPath',
                '=',
                sub.recordPath ?? '',
              ),
              eb('moderation_subject_status.convoId', '=', sub.convoId),
            ]),
          ),
        ),
      )

    const [statusRes, accountsByDid] = await Promise.all([
      builder.execute(),
      this.getAccoutInfosByDid(parsedSubjects.map((s) => s.did)),
    ])

    return new Map(
      statusRes.map((row): [string, ModerationSubjectStatusRowWithHandle] => {
        const subjectId = formatSubjectId(row.did, row.recordPath, row.convoId)
        const handle = accountsByDid.get(row.did)?.handle ?? INVALID_HANDLE
        return [subjectId, { ...row, handle }]
      }),
    )
  }

  formatSubjectStatus(
    status: ModerationSubjectStatusRowWithHandle,
  ): tools.ozone.moderation.defs.SubjectStatusView {
    const statusView: tools.ozone.moderation.defs.SubjectStatusView = {
      id: status.id,
      reviewState: status.reviewState,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
      comment: status.comment ?? undefined,
      lastReviewedBy: status.lastReviewedBy ?? undefined,
      lastReviewedAt: status.lastReviewedAt ?? undefined,
      lastReportedAt: status.lastReportedAt ?? undefined,
      lastAppealedAt: status.lastAppealedAt ?? undefined,
      muteUntil: status.muteUntil ?? undefined,
      muteReportingUntil: status.muteReportingUntil ?? undefined,
      suspendUntil: status.suspendUntil ?? undefined,
      takendown: status.takendown ?? undefined,
      appealed: status.appealed ?? undefined,
      subjectRepoHandle: status.handle ?? undefined,
      subjectBlobCids: status.blobCids || [],
      tags: status.tags || [],
      priorityScore: status.priorityScore,
      ageAssuranceState: status.ageAssuranceState ?? undefined,
      ageAssuranceUpdatedBy: status.ageAssuranceUpdatedBy ?? undefined,
      subject: subjectFromStatusRow(
        status,
      ).lex() as tools.ozone.moderation.defs.SubjectStatusView['subject'],

      // Explicitly typing to allow for easy manipulation (e.g. to strip from tests snapshots)
      accountStats: tools.ozone.moderation.defs.accountStats.$build({
        // account_events_stats
        reportCount: status.reportCount ?? undefined,
        appealCount: status.appealCount ?? undefined,
        suspendCount: status.suspendCount ?? undefined,
        takedownCount: status.takedownCount ?? undefined,
        escalateCount: status.escalateCount ?? undefined,
      }),

      // Explicitly typing to allow for easy manipulation (e.g. to strip from tests snapshots)
      recordsStats: tools.ozone.moderation.defs.recordsStats.$build({
        // account_record_events_stats
        totalReports: status.totalReports ?? undefined,
        reportedCount: status.reportedCount ?? undefined,
        escalatedCount: status.escalatedCount ?? undefined,
        appealedCount: status.appealedCount ?? undefined,

        // account_record_status_stats
        subjectCount: status.subjectCount ?? undefined,
        pendingCount: status.pendingCount ?? undefined,
        processedCount: status.processedCount ?? undefined,
        takendownCount: status.takendownCount ?? undefined,
      }),

      accountStrike:
        status.strikeCount !== null || status.totalStrikeCount !== null
          ? tools.ozone.moderation.defs.accountStrike.$build({
              activeStrikeCount: status.strikeCount ?? undefined,
              totalStrikeCount: status.totalStrikeCount ?? undefined,
              firstStrikeAt: status.firstStrikeAt ?? undefined,
              lastStrikeAt: status.lastStrikeAt ?? undefined,
            })
          : undefined,
    }

    if (status.recordPath !== '') {
      statusView.hosting = tools.ozone.moderation.defs.recordHosting.$build({
        updatedAt: status.hostingUpdatedAt ?? undefined,
        deletedAt: status.hostingDeletedAt ?? undefined,
        status: status.hostingStatus ?? 'unknown',
      })
    } else {
      statusView.hosting = tools.ozone.moderation.defs.accountHosting.$build({
        updatedAt: status.hostingUpdatedAt ?? undefined,
        deletedAt: status.hostingDeletedAt ?? undefined,
        status: status.hostingStatus ?? 'unknown',
        deactivatedAt: status.hostingDeactivatedAt ?? undefined,
        reactivatedAt: status.hostingReactivatedAt ?? undefined,
      })
    }

    return statusView
  }

  async fetchAuthorFeed(
    actor: AtIdentifierString,
  ): Promise<app.bsky.feed.defs.FeedViewPost[]> {
    const auth = await this.appviewAuth(app.bsky.feed.getAuthorFeed.$lxm)
    if (!auth) return []
    const { feed } = await this.appviewClient.call(
      app.bsky.feed.getAuthorFeed,
      { actor },
      auth,
    )

    return feed
  }

  async getProfiles(dids: DidString[]) {
    const profiles = new Map<string, app.bsky.actor.defs.ProfileViewDetailed>()

    const auth = await this.appviewAuth(app.bsky.actor.getProfiles.$lxm)
    if (!auth) return profiles

    for (const actors of chunkArray(dids, 25)) {
      const body = await this.appviewClient.call(
        app.bsky.actor.getProfiles,
        { actors },
        auth,
      )

      body.profiles.forEach((profile) => {
        profiles.set(profile.did, profile)
      })
    }

    return profiles
  }
}

type RecordSubject = { uri: AtUriString; cid?: string }

type SubjectView = tools.ozone.moderation.defs.ModEventViewDetail['subject']
// @TODO tidy
// type SubjectView = tools.ozone.moderation.defs.ModEventViewDetail['subject'] & ReportViewDetail['subject']

type RecordInfo = {
  uri: AtUriString
  cid: string
  value: Record<string, unknown>
  indexedAt: DatetimeString
}

function formatSubjectId(
  did: DidString,
  recordPath?: string,
  convoId?: string,
) {
  if (recordPath) return `at://${did}/${recordPath}`
  if (convoId) return `at://${did}/${CHAT_CONVO_COLLECTION}/${convoId}`
  return did
}

function findBlobRefs(value: unknown, refs: BlobRef[] = []) {
  if (isBlobRef(value)) {
    refs.push(value)
  } else if (Array.isArray(value)) {
    value.forEach((val) => findBlobRefs(val, refs))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((val) => findBlobRefs(val, refs))
  }
  return refs
}

export function getSelfLabels(details: {
  uri: AtUriString | null
  cid: string | null
  record: Record<string, unknown> | null
}): com.atproto.label.defs.Label[] {
  const { uri, cid, record } = details
  if (!uri || !cid || !record) return []
  if (!isValidSelfLabels(record.labels)) return []
  const src = new AtUri(uri).did // record creator
  const cts =
    typeof record.createdAt === 'string'
      ? normalizeDatetimeAlways(record.createdAt)
      : toDatetimeString(0)
  return record.labels.values.map(({ val }) => {
    return { src, uri, cid, val, cts }
  })
}

// The atproto data model requires all integers to fit within 53 bits
// (Number.MAX_SAFE_INTEGER). External tools may write larger numbers into
// "unknown"-typed fields like modTool.meta, which causes lex-json parse
// failures on the client side. This helper converts unsafe integers to strings.
function sanitizeUnsafeIntegers(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : String(value)
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeUnsafeIntegers)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeUnsafeIntegers(v)
    }
    return out
  }
  return value
}
