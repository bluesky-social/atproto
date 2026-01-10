import { sql } from 'kysely'
import {
  AppBskyActorDefs,
  AtpAgent,
  ComAtprotoRepoGetRecord,
} from '@atproto/api'
import { chunkArray, dedupeStrs } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { BlobRef } from '@atproto/lexicon'
import { AtUri, INVALID_HANDLE, normalizeDatetimeAlways } from '@atproto/syntax'
import { Database } from '../db'
import { LabelRow } from '../db/schema/label'
import { ids } from '../lexicon/lexicons'
import { FeedViewPost } from '../lexicon/types/app/bsky/feed/defs'
import { AccountView } from '../lexicon/types/com/atproto/admin/defs'
import {
  Label,
  validateSelfLabels,
} from '../lexicon/types/com/atproto/label/defs'
import { OutputSchema as ReportOutput } from '../lexicon/types/com/atproto/moderation/createReport'
import { REASONOTHER } from '../lexicon/types/com/atproto/moderation/defs'
import {
  BlobView,
  ModEventView,
  ModEventViewDetail,
  RecordView,
  RecordViewDetail,
  RepoView,
  SubjectStatusView,
  isAccountEvent,
  isAgeAssuranceEvent,
  isAgeAssuranceOverrideEvent,
  isIdentityEvent,
  isModEventAcknowledge,
  isModEventComment,
  isModEventEmail,
  isModEventEscalate,
  isModEventLabel,
  isModEventMute,
  isModEventMuteReporter,
  isModEventPriorityScore,
  isModEventReport,
  isModEventReverseTakedown,
  isModEventTag,
  isModEventTakedown,
  isRecordEvent,
  isScheduleTakedownEvent,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { Un$Typed, asPredicate } from '../lexicon/util'
import { dbLogger, httpLogger } from '../logger'
import { ParsedLabelers } from '../util'
import { moderationSubjectStatusQueryBuilder } from './status'
import { subjectFromEventRow, subjectFromStatusRow } from './subject'
import {
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRowWithHandle,
} from './types'
import { formatLabel, getPdsAgentForRepo, signLabel } from './util'

const isValidSelfLabels = asPredicate(validateSelfLabels)

const ifString = (val: unknown): string | undefined =>
  typeof val === 'string' ? val : undefined
const ifBoolean = (val: unknown): boolean | undefined =>
  typeof val === 'boolean' ? val : undefined
const ifNumber = (val: unknown): number | undefined =>
  typeof val === 'number' ? val : undefined

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
    private appviewAgent: AtpAgent,
    private appviewAuth: (method: string) => Promise<AuthHeaders>,
    public idResolver: IdResolver,
    public devMode?: boolean,
  ) {}

  async getAccoutInfosByDid(dids: string[]): Promise<Map<string, AccountView>> {
    if (dids.length === 0) return new Map()
    const auth = await this.appviewAuth(ids.ComAtprotoAdminGetAccountInfos)
    if (!auth) return new Map()
    try {
      const res = await this.appviewAgent.com.atproto.admin.getAccountInfos(
        {
          dids: dedupeStrs(dids),
        },
        auth,
      )
      return res.data.infos.reduce((acc, cur) => {
        return acc.set(cur.did, cur)
      }, new Map<string, AccountView>())
    } catch (err) {
      httpLogger.error(
        { err, dids },
        'failed to resolve account infos from appview',
      )
      return new Map()
    }
  }

  async repos(dids: string[]): Promise<Map<string, RepoView>> {
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
    }, new Map<string, RepoView>())
  }

  formatEvent(row: ModerationEventRowWithHandle): Un$Typed<ModEventView> {
    const eventView: Un$Typed<ModEventView> = {
      id: row.id,
      event: {
        $type: row.action,
        comment: row.comment ?? undefined,
      },
      subject: subjectFromEventRow(row).lex(),
      subjectBlobCids: row.subjectBlobCids ?? [],
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      subjectHandle: row.subjectHandle ?? undefined,
      creatorHandle: row.creatorHandle ?? undefined,
      modTool: row.modTool
        ? {
            name: row.modTool.name,
            meta: row.modTool.meta,
          }
        : undefined,
    }

    const { event } = eventView
    const meta = row.meta || {}

    if (
      isModEventMuteReporter(event) ||
      isModEventTakedown(event) ||
      isModEventLabel(event) ||
      isModEventMute(event)
    ) {
      event.durationInHours = row.durationInHours ?? undefined
    }

    if (
      (isModEventTakedown(event) || isModEventAcknowledge(event)) &&
      meta.acknowledgeAccountSubjects
    ) {
      event.acknowledgeAccountSubjects = ifBoolean(
        meta.acknowledgeAccountSubjects,
      )!
    }

    if (isModEventPriorityScore(event)) {
      event.score = ifNumber(meta?.priorityScore) ?? 0
    }

    if (
      isModEventTakedown(event) ||
      isModEventEmail(event) ||
      isModEventReverseTakedown(event)
    ) {
      if (typeof meta.policies === 'string' && meta.policies.length > 0) {
        event.policies = meta.policies.split(',')
      }

      event.strikeCount = ifNumber(row.strikeCount)
      event.severityLevel = ifString(row.severityLevel)

      if (isModEventTakedown(event) || isModEventEmail(event)) {
        event.strikeExpiresAt = ifString(row.strikeExpiresAt)
      }
    }

    if (isModEventTakedown(event)) {
      if (
        typeof meta.targetServices === 'string' &&
        meta.targetServices.length > 0
      ) {
        event.targetServices = meta.targetServices.split(',')
      }
    }

    if (isModEventLabel(event)) {
      event.createLabelVals = row.createLabelVals?.length
        ? row.createLabelVals.split(' ')
        : []
      event.negateLabelVals = row.negateLabelVals?.length
        ? row.negateLabelVals.split(' ')
        : []
    } else if (
      isModEventAcknowledge(event) ||
      isModEventTakedown(event) ||
      isModEventEscalate(event)
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

    if (isModEventReport(event)) {
      event.isReporterMuted = !!meta.isReporterMuted
      event.reportType = ifString(meta.reportType)!
    }

    if (isModEventEmail(event)) {
      event.content = ifString(meta.content)!
      event.subjectLine = ifString(meta.subjectLine)!
      event.isDelivered = ifBoolean(meta.isDelivered)
    }

    if (isModEventComment(event) && meta.sticky) {
      event.sticky = true
    }

    if (isModEventTag(event)) {
      event.add = row.addedTags || []
      event.remove = row.removedTags || []
    }

    if (isAccountEvent(event)) {
      event.active = !!meta.active
      event.timestamp = ifString(meta.timestamp)!
      event.status = ifString(meta.status)!
    }

    if (isIdentityEvent(event)) {
      event.timestamp = ifString(meta.timestamp)!
      event.handle = ifString(meta.handle)!
      event.pdsHost = ifString(meta.pdsHost)!
      event.tombstone = !!meta.tombstone
    }

    if (isRecordEvent(event)) {
      event.op = ifString(meta.op)!
      event.cid = ifString(meta.cid)!
      event.timestamp = ifString(meta.timestamp)!
    }

    if (isAgeAssuranceEvent(event)) {
      event.status = ifString(meta.status)!
      event.access = ifString(meta.access)!
      event.createdAt = ifString(meta.createdAt)!
      event.attemptId = ifString(meta.attemptId)!
      event.initIp = ifString(meta.initIp)
      event.initUa = ifString(meta.initUa)
      event.completeIp = ifString(meta.completeIp)
      event.completeUa = ifString(meta.completeUa)
    }

    if (isAgeAssuranceOverrideEvent(event)) {
      event.status = ifString(meta.status)!
      event.access = ifString(meta.access)!
    }

    if (isScheduleTakedownEvent(event)) {
      event.executeAt = ifString(meta.executeAt)
      event.executeAfter = ifString(meta.executeAfter)
      event.executeUntil = ifString(meta.executeUntil)
    }

    return eventView
  }

  async eventDetail(
    result: ModerationEventRowWithHandle,
  ): Promise<ModEventViewDetail> {
    const subjectId =
      result.subjectType === 'com.atproto.admin.defs#repoRef'
        ? result.subjectDid
        : result.subjectUri
    if (!subjectId) {
      throw new Error(`Bad subject: ${result.id}`)
    }
    const subject = await this.subject(subjectId)
    const eventView = this.formatEvent(result)
    const allBlobs = 'value' in subject ? findBlobRefs(subject.value) : []
    const subjectBlobs = await this.blob(
      allBlobs.filter((blob) =>
        eventView.subjectBlobCids.includes(blob.ref.toString()),
      ),
    )
    return {
      ...eventView,
      subject,
      subjectBlobs,
    }
  }

  async repoDetails(
    dids: string[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, RepoView>> {
    const results = new Map<string, RepoView>()
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
    params: ComAtprotoRepoGetRecord.QueryParams,
    appviewAuth: AuthHeaders,
  ) {
    try {
      const record = await this.appviewAgent.com.atproto.repo.getRecord(
        params,
        appviewAuth,
      )
      return record
    } catch (err) {
      if (err instanceof ComAtprotoRepoGetRecord.RecordNotFoundError) {
        // If pds fetch fails, just return null regardless of the error
        try {
          const { agent: pdsAgent } = await getPdsAgentForRepo(
            this.idResolver,
            params.repo,
            this.devMode,
          )
          if (!pdsAgent) {
            return null
          }

          const record = await pdsAgent.com.atproto.repo.getRecord(params)
          return record
        } catch (error) {
          return null
        }
      }

      return null
    }
  }

  async fetchRecords(
    subjects: RecordSubject[],
  ): Promise<Map<string, RecordInfo>> {
    const appviewAuth = await this.appviewAuth(ids.ComAtprotoRepoGetRecord)
    if (!appviewAuth) return new Map()

    const fetched = await Promise.all(
      subjects.map(async (subject) => {
        const uri = new AtUri(subject.uri)
        const params = {
          repo: uri.hostname,
          collection: uri.collection,
          rkey: uri.rkey,
          cid: subject.cid,
        }
        return this.fetchRecord(params, appviewAuth)
      }),
    )
    return fetched.reduce((acc, cur) => {
      if (!cur) return acc
      const data = cur.data
      const indexedAt = new Date().toISOString()
      return acc.set(data.uri, { ...data, cid: data.cid ?? '', indexedAt })
    }, new Map<string, RecordInfo>())
  }

  async records(subjects: RecordSubject[]) {
    const uris = subjects.map((record) => new AtUri(record.uri))
    const dids = uris.map((u) => u.hostname)

    const [repos, subjectStatuses, records] = await Promise.all([
      this.repos(dids),
      this.getSubjectStatus(subjects.map((s) => s.uri)),
      this.fetchRecords(subjects),
    ])

    const map = new Map<
      string,
      // Because the result of this function is used to build RecordViewDetail,
      // we explicitly type the result without the $type field, so can be used
      // as both RecordView and RecordViewDetail, without having to cast or
      // override the $type field.
      RecordView & {
        $type?: undefined
        moderation: { $type?: undefined; subjectStatus?: SubjectStatusView }
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
        value: record.value,
        blobCids: findBlobRefs(record.value).map((blob) => blob.ref.toString()),
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
  ): Promise<Map<string, RecordViewDetail>> {
    const results = new Map<string, RecordViewDetail>()
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
  ): Promise<Map<string, Label[]>> {
    const results = new Map<string, Label[]>()
    if (!labelers?.dids.length && !labelers?.redact.size) return results
    try {
      const {
        data: { labels },
      } = await this.appviewAgent.com.atproto.label.queryLabels({
        uriPatterns: subjects,
        sources: labelers.dids,
      })
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

  formatReport(report: ModerationEventRowWithHandle): ReportOutput {
    return {
      id: report.id,
      createdAt: report.createdAt,
      // Ideally, we would never have a report entry that does not have a reasonType but at the schema level
      // we are not guarantying that so in whatever case, if we end up with such entries, default to 'other'
      reasonType: report.meta?.reportType
        ? (report.meta?.reportType as string)
        : REASONOTHER,
      reason: report.comment ?? undefined,
      reportedBy: report.createdBy,
      subject: subjectFromEventRow(report).lex() as ReportOutput['subject'],
    }
  }
  // Partial view for subjects

  async subject(subject: string): Promise<SubjectView> {
    if (subject.startsWith('did:')) {
      const repos = await this.repos([subject])
      const repo = repos.get(subject)
      if (repo) {
        return {
          ...repo,
          $type: 'tools.ozone.moderation.defs#repoView',
        }
      } else {
        return {
          $type: 'tools.ozone.moderation.defs#repoViewNotFound',
          did: subject,
        }
      }
    } else {
      const records = await this.records([{ uri: subject }])
      const record = records.get(subject)
      if (record) {
        return {
          ...record,
          $type: 'tools.ozone.moderation.defs#recordView',
        }
      } else {
        return {
          $type: 'tools.ozone.moderation.defs#recordViewNotFound',
          uri: subject,
        }
      }
    }
  }

  // Partial view for blobs

  async blob(blobs: BlobRef[]): Promise<BlobView[]> {
    if (!blobs.length) return []
    const { ref } = this.db.db.dynamic
    const modStatusResults = await moderationSubjectStatusQueryBuilder(
      this.db.db,
    )
      .where(
        sql<string>`${ref(
          'moderation_subject_status.blobCids',
        )} @> ${JSON.stringify(blobs.map((blob) => blob.ref.toString()))}`,
      )
      .executeTakeFirst()

    const statusByCid = (modStatusResults?.blobCids || [])?.reduce(
      (acc, cur) => Object.assign(acc, { [cur]: modStatusResults }),
      {},
    )
    // Intentionally missing details field, since we don't have any on appview.
    // We also don't know when the blob was created, so we use a canned creation time.
    const unknownTime = new Date(0).toISOString()
    return blobs.map((blob) => {
      const cid = blob.ref.toString()
      const subjectStatus = statusByCid[cid]
        ? this.formatSubjectStatus(statusByCid[cid])
        : undefined

      return {
        cid,
        mimeType: blob.mimeType,
        size: blob.size,
        createdAt: unknownTime,
        moderation: {
          subjectStatus,
        },
      }
    })
  }

  async labels(
    subjects: string[],
    includeNeg?: boolean,
  ): Promise<Map<string, Label[]>> {
    const now = new Date().toISOString()
    const labels = new Map<string, Label[]>()
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', 'in', subjects)
      .where((qb) =>
        qb.where('label.exp', 'is', null).orWhere('label.exp', '>', now),
      )
      .if(!includeNeg, (qb) => qb.where('neg', '=', false))
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
    subjects: string[],
  ): Promise<Map<string, ModerationSubjectStatusRowWithHandle>> {
    if (!subjects.length) return new Map()

    const parsedSubjects = subjects.map(parseSubjectId)

    const builder = moderationSubjectStatusQueryBuilder(this.db.db)
      //
      .where((qb) => {
        for (const sub of parsedSubjects) {
          qb = qb.orWhere((qb) =>
            qb
              .where('moderation_subject_status.did', '=', sub.did)
              .where(
                'moderation_subject_status.recordPath',
                '=',
                sub.recordPath ?? '',
              ),
          )
        }
        return qb
      })

    const [statusRes, accountsByDid] = await Promise.all([
      builder.execute(),
      this.getAccoutInfosByDid(parsedSubjects.map((s) => s.did)),
    ])

    return new Map(
      statusRes.map((row): [string, ModerationSubjectStatusRowWithHandle] => {
        const subjectId = formatSubjectId(row.did, row.recordPath)
        const handle = accountsByDid.get(row.did)?.handle ?? INVALID_HANDLE
        return [subjectId, { ...row, handle }]
      }),
    )
  }

  formatSubjectStatus(
    status: ModerationSubjectStatusRowWithHandle,
  ): SubjectStatusView {
    const statusView: SubjectStatusView = {
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
      ).lex() as SubjectStatusView['subject'],

      accountStats: {
        // Explicitly typing to allow for easy manipulation (e.g. to strip from tests snapshots)
        $type: 'tools.ozone.moderation.defs#accountStats',

        // account_events_stats
        reportCount: status.reportCount ?? undefined,
        appealCount: status.appealCount ?? undefined,
        suspendCount: status.suspendCount ?? undefined,
        takedownCount: status.takedownCount ?? undefined,
        escalateCount: status.escalateCount ?? undefined,
      },

      recordsStats: {
        // Explicitly typing to allow for easy manipulation (e.g. to strip from tests snapshots)
        $type: 'tools.ozone.moderation.defs#recordsStats',

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
      },

      accountStrike:
        status.strikeCount !== null || status.totalStrikeCount !== null
          ? {
              $type: 'tools.ozone.moderation.defs#accountStrike',
              activeStrikeCount: status.strikeCount ?? undefined,
              totalStrikeCount: status.totalStrikeCount ?? undefined,
              firstStrikeAt: status.firstStrikeAt ?? undefined,
              lastStrikeAt: status.lastStrikeAt ?? undefined,
            }
          : undefined,
    }

    if (status.recordPath !== '') {
      statusView.hosting = {
        $type: 'tools.ozone.moderation.defs#recordHosting',
        updatedAt: status.hostingUpdatedAt ?? undefined,
        deletedAt: status.hostingDeletedAt ?? undefined,
        status: status.hostingStatus ?? 'unknown',
      }
    } else {
      statusView.hosting = {
        $type: 'tools.ozone.moderation.defs#accountHosting',
        updatedAt: status.hostingUpdatedAt ?? undefined,
        deletedAt: status.hostingDeletedAt ?? undefined,
        status: status.hostingStatus ?? 'unknown',
        deactivatedAt: status.hostingDeactivatedAt ?? undefined,
        reactivatedAt: status.hostingReactivatedAt ?? undefined,
      }
    }

    return statusView
  }

  async fetchAuthorFeed(actor: string): Promise<FeedViewPost[]> {
    const auth = await this.appviewAuth(ids.AppBskyFeedGetAuthorFeed)
    if (!auth) return []
    const {
      data: { feed },
    } = await this.appviewAgent.app.bsky.feed.getAuthorFeed({ actor }, auth)

    return feed
  }

  async getProfiles(dids: string[]) {
    const profiles = new Map<string, AppBskyActorDefs.ProfileViewDetailed>()

    const auth = await this.appviewAuth(ids.AppBskyActorGetProfiles)
    if (!auth) return profiles

    for (const actors of chunkArray(dids, 25)) {
      const { data } = await this.appviewAgent.getProfiles({ actors }, auth)

      data.profiles.forEach((profile) => {
        profiles.set(profile.did, profile)
      })
    }

    return profiles
  }
}

type RecordSubject = { uri: string; cid?: string }

type SubjectView = ModEventViewDetail['subject']
// @TODO tidy
// type SubjectView = ModEventViewDetail['subject'] & ReportViewDetail['subject']

type RecordInfo = {
  uri: string
  cid: string
  value: Record<string, unknown>
  indexedAt: string
}

function parseSubjectId(subject: string): { did: string; recordPath?: string } {
  if (subject.startsWith('did:')) {
    return { did: subject }
  }
  const uri = new AtUri(subject)
  return { did: uri.hostname, recordPath: `${uri.collection}/${uri.rkey}` }
}

function formatSubjectId(did: string, recordPath?: string) {
  return recordPath ? `at://${did}/${recordPath}` : did
}

function findBlobRefs(value: unknown, refs: BlobRef[] = []) {
  if (value instanceof BlobRef) {
    refs.push(value)
  } else if (Array.isArray(value)) {
    value.forEach((val) => findBlobRefs(val, refs))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((val) => findBlobRefs(val, refs))
  }
  return refs
}

export function getSelfLabels(details: {
  uri: string | null
  cid: string | null
  record: Record<string, unknown> | null
}): Label[] {
  const { uri, cid, record } = details
  if (!uri || !cid || !record) return []
  if (!isValidSelfLabels(record.labels)) return []
  const src = new AtUri(uri).host // record creator
  const cts =
    typeof record.createdAt === 'string'
      ? normalizeDatetimeAlways(record.createdAt)
      : new Date(0).toISOString()
  return record.labels.values.map(({ val }) => {
    return { src, uri, cid, val, cts }
  })
}
