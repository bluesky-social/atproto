import { sql } from 'kysely'
import { AtUri, INVALID_HANDLE, normalizeDatetimeAlways } from '@atproto/syntax'
import {
  AtpAgent,
  AppBskyFeedDefs,
  ToolsOzoneModerationDefs,
} from '@atproto/api'
import { dedupeStrs } from '@atproto/common'
import { BlobRef } from '@atproto/lexicon'
import { Keypair } from '@atproto/crypto'
import { Database } from '../db'
import {
  ModEventView,
  RepoView,
  RepoViewDetail,
  RecordView,
  RecordViewDetail,
  BlobView,
  SubjectStatusView,
  ModEventViewDetail,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { AccountView } from '../lexicon/types/com/atproto/admin/defs'
import { OutputSchema as ReportOutput } from '../lexicon/types/com/atproto/moderation/createReport'
import { Label, isSelfLabels } from '../lexicon/types/com/atproto/label/defs'
import {
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRowWithHandle,
} from './types'
import { REASONOTHER } from '../lexicon/types/com/atproto/moderation/defs'
import { subjectFromEventRow, subjectFromStatusRow } from './subject'
import { formatLabel, signLabel } from './util'
import { LabelRow } from '../db/schema/label'
import { dbLogger } from '../logger'
import { httpLogger } from '../logger'
import { ParsedLabelers } from '../util'
import { ids } from '../lexicon/lexicons'

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
  ) {}

  async getAccoutInfosByDid(dids: string[]): Promise<Map<string, AccountView>> {
    if (dids.length === 0) return new Map()
    const auth = await this.appviewAuth(ids.ComAtprotoAdminGetAccountInfos)
    if (!auth) return new Map()
    try {
      const res = await this.appviewAgent.api.com.atproto.admin.getAccountInfos(
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

  formatEvent(event: ModerationEventRowWithHandle): ModEventView {
    const eventView: ModEventView = {
      id: event.id,
      event: {
        $type: event.action,
        comment: event.comment ?? undefined,
      },
      subject: subjectFromEventRow(event).lex(),
      subjectBlobCids: event.subjectBlobCids ?? [],
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      subjectHandle: event.subjectHandle ?? undefined,
      creatorHandle: event.creatorHandle ?? undefined,
    }

    if (
      [
        'tools.ozone.moderation.defs#modEventMuteReporter',
        'tools.ozone.moderation.defs#modEventTakedown',
        'tools.ozone.moderation.defs#modEventMute',
      ].includes(event.action)
    ) {
      eventView.event = {
        ...eventView.event,
        durationInHours: event.durationInHours ?? undefined,
      }
    }

    if (
      event.action === 'tools.ozone.moderation.defs#modEventTakedown' &&
      event.meta?.acknowledgeAccountSubjects
    ) {
      eventView.event = {
        ...eventView.event,
        acknowledgeAccountSubjects: event.meta?.acknowledgeAccountSubjects,
      }
    }

    if (event.action === 'tools.ozone.moderation.defs#modEventLabel') {
      eventView.event = {
        ...eventView.event,
        createLabelVals: event.createLabelVals?.length
          ? event.createLabelVals.split(' ')
          : [],
        negateLabelVals: event.negateLabelVals?.length
          ? event.negateLabelVals.split(' ')
          : [],
      }
    }

    // This is for legacy data only, for new events, these types of events won't have labels attached
    if (
      [
        'tools.ozone.moderation.defs#modEventAcknowledge',
        'tools.ozone.moderation.defs#modEventTakedown',
        'tools.ozone.moderation.defs#modEventEscalate',
      ].includes(event.action)
    ) {
      if (event.createLabelVals?.length) {
        eventView.event = {
          ...eventView.event,
          createLabelVals: event.createLabelVals.split(' '),
        }
      }

      if (event.negateLabelVals?.length) {
        eventView.event = {
          ...eventView.event,
          negateLabelVals: event.negateLabelVals.split(' '),
        }
      }
    }

    if (event.action === 'tools.ozone.moderation.defs#modEventReport') {
      eventView.event = {
        ...eventView.event,
        reportType: event.meta?.reportType ?? undefined,
        isReporterMuted: !!event.meta?.isReporterMuted,
      }
    }

    if (event.action === 'tools.ozone.moderation.defs#modEventEmail') {
      eventView.event = {
        ...eventView.event,
        subjectLine: event.meta?.subjectLine ?? '',
        content: event.meta?.content,
      }
    }

    if (
      event.action === 'tools.ozone.moderation.defs#modEventComment' &&
      event.meta?.sticky
    ) {
      eventView.event.sticky = true
    }

    if (event.action === 'tools.ozone.moderation.defs#modEventTag') {
      eventView.event.add = event.addedTags || []
      eventView.event.remove = event.removedTags || []
    }

    if (event.action === 'tools.ozone.moderation.defs#accountEvent') {
      eventView.event.active = !!event.meta?.active
      eventView.event.timestamp = event.meta?.timestamp
      eventView.event.status = event.meta?.status
    }

    if (event.action === 'tools.ozone.moderation.defs#identityEvent') {
      eventView.event.timestamp = event.meta?.timestamp
      eventView.event.handle = event.meta?.handle
      eventView.event.pdsHost = event.meta?.pdsHost
      eventView.event.tombstone = !!event.meta?.tombstone
    }

    if (event.action === 'tools.ozone.moderation.defs#recordEvent') {
      eventView.event.op = event.meta?.op
      eventView.event.cid = event.meta?.cid
      eventView.event.timestamp = event.meta?.timestamp
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
    const allBlobs = findBlobRefs(subject.value)
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

  async fetchRecords(
    subjects: RecordSubject[],
  ): Promise<Map<string, RecordInfo>> {
    const auth = await this.appviewAuth(ids.ComAtprotoRepoGetRecord)
    if (!auth) return new Map()
    const fetched = await Promise.all(
      subjects.map(async (subject) => {
        const uri = new AtUri(subject.uri)
        try {
          const record = await this.appviewAgent.api.com.atproto.repo.getRecord(
            {
              repo: uri.hostname,
              collection: uri.collection,
              rkey: uri.rkey,
              cid: subject.cid,
            },
            auth,
          )
          return record
        } catch {
          return null
        }
      }),
    )
    return fetched.reduce((acc, cur) => {
      if (!cur) return acc
      const data = cur.data
      const indexedAt = new Date().toISOString()
      return acc.set(data.uri, { ...data, cid: data.cid ?? '', indexedAt })
    }, new Map<string, RecordInfo>())
  }

  async records(subjects: RecordSubject[]): Promise<Map<string, RecordView>> {
    const uris = subjects.map((record) => new AtUri(record.uri))
    const dids = uris.map((u) => u.hostname)

    const [repos, subjectStatuses, records] = await Promise.all([
      this.repos(dids),
      this.getSubjectStatus(subjects.map((s) => s.uri)),
      this.fetchRecords(subjects),
    ])

    return uris.reduce((acc, uri) => {
      const repo = repos.get(uri.hostname)
      if (!repo) return acc
      const record = records.get(uri.toString())
      if (!record) return acc
      const subjectStatus = subjectStatuses.get(uri.toString())
      return acc.set(uri.toString(), {
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
    }, new Map<string, RecordView>())
  }

  async recordDetails(
    subjects: RecordSubject[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, RecordViewDetail>> {
    const subjectUris = subjects.map((s) => s.uri)
    const [records, subjectStatusesResult, localLabels, externalLabels] =
      await Promise.all([
        this.records(subjects),
        this.getSubjectStatus(subjectUris),
        this.labels(subjectUris),
        this.getExternalLabels(subjectUris, labelers),
      ])

    const results = new Map<string, RecordViewDetail>()

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
      } = await this.appviewAgent.api.com.atproto.label.queryLabels({
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
      subject: subjectFromEventRow(report).lex(),
    }
  }
  // Partial view for subjects

  async subject(subject: string): Promise<SubjectView> {
    if (subject.startsWith('did:')) {
      const repos = await this.repos([subject])
      const repo = repos.get(subject)
      if (repo) {
        return {
          $type: 'com.atproto.admin.defs#repoView',
          ...repo,
        }
      } else {
        return {
          $type: 'com.atproto.admin.defs#repoViewNotFound',
          did: subject,
        }
      }
    } else {
      const records = await this.records([{ uri: subject }])
      const record = records.get(subject)
      if (record) {
        return {
          $type: 'com.atproto.admin.defs#recordView',
          ...record,
        }
      } else {
        return {
          $type: 'com.atproto.admin.defs#recordViewNotFound',
          uri: subject,
        }
      }
    }
  }

  // Partial view for blobs

  async blob(blobs: BlobRef[]): Promise<BlobView[]> {
    if (!blobs.length) return []
    const { ref } = this.db.db.dynamic
    const modStatusResults = await this.db.db
      .selectFrom('moderation_subject_status')
      .where(
        sql<string>`${ref(
          'moderation_subject_status.blobCids',
        )} @> ${JSON.stringify(blobs.map((blob) => blob.ref.toString()))}`,
      )
      .selectAll()
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
    const labels = new Map<string, Label[]>()
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', 'in', subjects)
      .if(!includeNeg, (qb) => qb.where('neg', '=', false))
      .selectAll()
      .execute()

    await Promise.all(
      res.map(async (labelRow) => {
        const signedLabel = await this.formatLabelAndEnsureSig(labelRow)
        if (!labels.has(labelRow.uri)) {
          labels.set(labelRow.uri, [])
        }
        labels.get(labelRow.uri)?.push(signedLabel)
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
    const parsedSubjects = subjects.map((subject) => parseSubjectId(subject))
    const filterForSubject = (did: string, recordPath?: string) => {
      return (clause: any) => {
        clause = clause
          .where('moderation_subject_status.did', '=', did)
          .where('moderation_subject_status.recordPath', '=', recordPath || '')
        return clause
      }
      // TODO: Fix the typing here?
    }

    const builder = this.db.db
      .selectFrom('moderation_subject_status')
      .where((clause) => {
        parsedSubjects.forEach((subject, i) => {
          const applySubjectFilter = filterForSubject(
            subject.did,
            subject.recordPath,
          )
          if (i === 0) {
            clause = clause.where(applySubjectFilter)
          } else {
            clause = clause.orWhere(applySubjectFilter)
          }
        })

        return clause
      })
      .selectAll()

    const [statusRes, accountsByDid] = await Promise.all([
      builder.execute(),
      this.getAccoutInfosByDid(parsedSubjects.map((s) => s.did)),
    ])

    return statusRes.reduce((acc, cur) => {
      const subject = cur.recordPath
        ? formatSubjectId(cur.did, cur.recordPath)
        : cur.did
      const handle = accountsByDid.get(cur.did)?.handle
      return acc.set(subject, {
        ...cur,
        handle: handle ?? INVALID_HANDLE,
      })
    }, new Map<string, ModerationSubjectStatusRowWithHandle>())
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
      subject: subjectFromStatusRow(status).lex(),
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

  async fetchAuthorFeed(
    actor: string,
  ): Promise<AppBskyFeedDefs.FeedViewPost[]> {
    const auth = await this.appviewAuth(ids.AppBskyFeedGetAuthorFeed)
    if (!auth) return []
    const {
      data: { feed },
    } = await this.appviewAgent.api.app.bsky.feed.getAuthorFeed({ actor }, auth)

    return feed
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

function parseSubjectId(subject: string) {
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
  if (!isSelfLabels(record.labels)) return []
  const src = new AtUri(uri).host // record creator
  const cts =
    typeof record.createdAt === 'string'
      ? normalizeDatetimeAlways(record.createdAt)
      : new Date(0).toISOString()
  return record.labels.values.map(({ val }) => {
    return { src, uri, cid, val, cts }
  })
}
