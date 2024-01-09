import { sql } from 'kysely'
import { AtUri, INVALID_HANDLE, normalizeDatetimeAlways } from '@atproto/syntax'
import AtpAgent from '@atproto/api'
import { dedupeStrs } from '@atproto/common'
import { BlobRef } from '@atproto/lexicon'
import { Database } from '../db'
import {
  ModEventView,
  RepoView,
  RepoViewDetail,
  RecordView,
  RecordViewDetail,
  ReportViewDetail,
  BlobView,
  SubjectStatusView,
  ModEventViewDetail,
  AccountView,
} from '../lexicon/types/com/atproto/admin/defs'
import { OutputSchema as ReportOutput } from '../lexicon/types/com/atproto/moderation/createReport'
import { Label, isSelfLabels } from '../lexicon/types/com/atproto/label/defs'
import {
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRowWithHandle,
} from './types'
import { REASONOTHER } from '../lexicon/types/com/atproto/moderation/defs'
import { subjectFromEventRow, subjectFromStatusRow } from './subject'

export type AppviewAuth = () => Promise<
  | {
      headers: {
        authorization: string
      }
    }
  | undefined
>

export class ModerationViews {
  constructor(
    private db: Database,
    private appviewAgent: AtpAgent,
    private appviewAuth: AppviewAuth,
  ) {}

  async getAccoutInfosByDid(dids: string[]): Promise<Map<string, AccountView>> {
    if (dids.length === 0) return new Map()
    const auth = await this.appviewAuth()
    if (!auth) return new Map()
    const res = await this.appviewAgent.api.com.atproto.admin.getAccountInfos(
      {
        dids: dedupeStrs(dids),
      },
      auth,
    )
    return res.data.infos.reduce((acc, cur) => {
      return acc.set(cur.did, cur)
    }, new Map<string, AccountView>())
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
      subjectBlobCids: [],
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      subjectHandle: event.subjectHandle ?? undefined,
      creatorHandle: event.creatorHandle ?? undefined,
    }

    if (
      [
        'com.atproto.admin.defs#modEventTakedown',
        'com.atproto.admin.defs#modEventMute',
      ].includes(event.action)
    ) {
      eventView.event = {
        ...eventView.event,
        durationInHours: event.durationInHours ?? undefined,
      }
    }

    if (event.action === 'com.atproto.admin.defs#modEventLabel') {
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
        'com.atproto.admin.defs#modEventAcknowledge',
        'com.atproto.admin.defs#modEventTakedown',
        'com.atproto.admin.defs#modEventEscalate',
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

    if (event.action === 'com.atproto.admin.defs#modEventReport') {
      eventView.event = {
        ...eventView.event,
        reportType: event.meta?.reportType ?? undefined,
      }
    }

    if (event.action === 'com.atproto.admin.defs#modEventEmail') {
      eventView.event = {
        ...eventView.event,
        subjectLine: event.meta?.subjectLine ?? '',
      }
    }

    if (
      event.action === 'com.atproto.admin.defs#modEventComment' &&
      event.meta?.sticky
    ) {
      eventView.event.sticky = true
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

  async repoDetail(did: string): Promise<RepoViewDetail | undefined> {
    const [repos, labels] = await Promise.all([
      this.repos([did]),
      this.labels(did),
    ])
    const repo = repos.get(did)
    if (!repo) return

    return {
      ...repo,
      moderation: {
        ...repo.moderation,
      },
      labels,
    }
  }

  async fetchRecords(
    subjects: RecordSubject[],
  ): Promise<Map<string, RecordInfo>> {
    const auth = await this.appviewAuth()
    if (!auth) return new Map()
    const fetched = await Promise.all(
      subjects.map(async (subject) => {
        const uri = new AtUri(subject.uri)
        try {
          return await this.appviewAgent.api.com.atproto.repo.getRecord(
            {
              repo: uri.hostname,
              collection: uri.collection,
              rkey: uri.rkey,
              cid: subject.cid,
            },
            auth,
          )
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

  async recordDetail(
    subject: RecordSubject,
  ): Promise<RecordViewDetail | undefined> {
    const [records, subjectStatusesResult] = await Promise.all([
      this.records([subject]),
      this.getSubjectStatus([subject.uri]),
    ])
    const record = records.get(subject.uri)
    if (!record) return undefined

    const status = subjectStatusesResult.get(subject.uri)

    const [blobs, labels, subjectStatus] = await Promise.all([
      this.blob(findBlobRefs(record.value)),
      this.labels(record.uri),
      status ? this.formatSubjectStatus(status) : Promise.resolve(undefined),
    ])
    const selfLabels = getSelfLabels({
      uri: record.uri,
      cid: record.cid,
      record: record.value,
    })
    return {
      ...record,
      blobs,
      moderation: {
        ...record.moderation,
        subjectStatus,
      },
      labels: [...labels, ...selfLabels],
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

  async labels(subject: string, includeNeg?: boolean): Promise<Label[]> {
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', '=', subject)
      .if(!includeNeg, (qb) => qb.where('neg', '=', false))
      .selectAll()
      .execute()
    return res.map((l) => ({
      ...l,
      cid: l.cid === '' ? undefined : l.cid,
      neg: l.neg,
    }))
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
    return {
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
      suspendUntil: status.suspendUntil ?? undefined,
      takendown: status.takendown ?? undefined,
      appealed: status.appealed ?? undefined,
      subjectRepoHandle: status.handle ?? undefined,
      subjectBlobCids: status.blobCids || [],
      subject: subjectFromStatusRow(status).lex(),
    }
  }
}

type RecordSubject = { uri: string; cid?: string }

type SubjectView = ModEventViewDetail['subject'] & ReportViewDetail['subject']

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
    return { src, uri, cid, val, cts, neg: false }
  })
}
