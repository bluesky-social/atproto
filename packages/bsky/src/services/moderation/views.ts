import { sql } from 'kysely'
import { ArrayEl } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import { INVALID_HANDLE } from '@atproto/syntax'
import { BlobRef, jsonStringToLex } from '@atproto/lexicon'
import { Database } from '../../db'
import { Actor } from '../../db/tables/actor'
import { Record as RecordRow } from '../../db/tables/record'
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
} from '../../lexicon/types/com/atproto/admin/defs'
import { OutputSchema as ReportOutput } from '../../lexicon/types/com/atproto/moderation/createReport'
import { Label } from '../../lexicon/types/com/atproto/label/defs'
import {
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRowWithHandle,
} from './types'
import { getSelfLabels } from '../label'
import { REASONOTHER } from '../../lexicon/types/com/atproto/moderation/defs'

export class ModerationViews {
  constructor(private db: Database) {}

  repo(result: RepoResult): Promise<RepoView>
  repo(result: RepoResult[]): Promise<RepoView[]>
  async repo(
    result: RepoResult | RepoResult[],
  ): Promise<RepoView | RepoView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [info, subjectStatuses] = await Promise.all([
      await this.db.db
        .selectFrom('actor')
        .leftJoin('profile', 'profile.creator', 'actor.did')
        .leftJoin(
          'record as profile_record',
          'profile_record.uri',
          'profile.uri',
        )
        .where(
          'actor.did',
          'in',
          results.map((r) => r.did),
        )
        .select(['actor.did as did', 'profile_record.json as profileJson'])
        .execute(),
      this.getSubjectStatus(results.map((r) => ({ did: r.did }))),
    ])

    const infoByDid = info.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof info>>,
    )
    const subjectStatusByDid = subjectStatuses.reduce(
      (acc, cur) =>
        Object.assign(acc, { [cur.did ?? '']: this.subjectStatus(cur) }),
      {},
    )

    const views = results.map((r) => {
      const { profileJson } = infoByDid[r.did] ?? {}
      const relatedRecords: object[] = []
      if (profileJson) {
        relatedRecords.push(
          jsonStringToLex(profileJson) as Record<string, unknown>,
        )
      }
      return {
        // No email or invite info on appview
        did: r.did,
        handle: r.handle ?? INVALID_HANDLE,
        relatedRecords,
        indexedAt: r.indexedAt,
        moderation: {
          subjectStatus: subjectStatusByDid[r.did] ?? undefined,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }
  event(result: EventResult): Promise<ModEventView>
  event(result: EventResult[]): Promise<ModEventView[]>
  async event(
    result: EventResult | EventResult[],
  ): Promise<ModEventView | ModEventView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const views = results.map((res) => {
      const eventView: ModEventView = {
        id: res.id,
        event: {
          $type: res.action,
          comment: res.comment ?? undefined,
        },
        subject:
          res.subjectType === 'com.atproto.admin.defs#repoRef'
            ? {
                $type: 'com.atproto.admin.defs#repoRef',
                did: res.subjectDid,
              }
            : {
                $type: 'com.atproto.repo.strongRef',
                uri: res.subjectUri,
                cid: res.subjectCid,
              },
        subjectBlobCids: [],
        createdBy: res.createdBy,
        createdAt: res.createdAt,
        subjectHandle: res.subjectHandle ?? undefined,
        creatorHandle: res.creatorHandle ?? undefined,
      }

      if (
        [
          'com.atproto.admin.defs#modEventTakedown',
          'com.atproto.admin.defs#modEventMute',
        ].includes(res.action)
      ) {
        eventView.event = {
          ...eventView.event,
          durationInHours: res.durationInHours ?? undefined,
        }
      }

      if (res.action === 'com.atproto.admin.defs#modEventLabel') {
        eventView.event = {
          ...eventView.event,
          createLabelVals: res.createLabelVals?.length
            ? res.createLabelVals.split(' ')
            : [],
          negateLabelVals: res.negateLabelVals?.length
            ? res.negateLabelVals.split(' ')
            : [],
        }
      }

      if (res.action === 'com.atproto.admin.defs#modEventReport') {
        eventView.event = {
          ...eventView.event,
          reportType: res.meta?.reportType ?? undefined,
        }
      }

      if (res.action === 'com.atproto.admin.defs#modEventEmail') {
        eventView.event = {
          ...eventView.event,
          subject: res.meta?.subject ?? undefined,
        }
      }

      if (
        res.action === 'com.atproto.admin.defs#modEventComment' &&
        res.meta?.sticky
      ) {
        eventView.event.sticky = true
      }

      return eventView
    })

    return Array.isArray(result) ? views : views[0]
  }

  async eventDetail(result: EventResult): Promise<ModEventViewDetail> {
    const [event, subject] = await Promise.all([
      this.event(result),
      this.subject(result),
    ])
    const allBlobs = findBlobRefs(subject.value)
    const subjectBlobs = await this.blob(
      allBlobs.filter((blob) =>
        event.subjectBlobCids.includes(blob.ref.toString()),
      ),
    )
    return {
      ...event,
      subject,
      subjectBlobs,
    }
  }

  async repoDetail(result: RepoResult): Promise<RepoViewDetail> {
    const [repo, labels] = await Promise.all([
      this.repo(result),
      this.labels(result.did),
    ])

    return {
      ...repo,
      moderation: {
        ...repo.moderation,
      },
      labels,
    }
  }

  record(result: RecordResult): Promise<RecordView>
  record(result: RecordResult[]): Promise<RecordView[]>
  async record(
    result: RecordResult | RecordResult[],
  ): Promise<RecordView | RecordView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [repoResults, subjectStatuses] = await Promise.all([
      this.db.db
        .selectFrom('actor')
        .where(
          'actor.did',
          'in',
          results.map((r) => didFromUri(r.uri)),
        )
        .selectAll()
        .execute(),
      this.getSubjectStatus(results.map((r) => didAndRecordPathFromUri(r.uri))),
    ])
    const repos = await this.repo(repoResults)

    const reposByDid = repos.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof repos>>,
    )
    const subjectStatusByUri = subjectStatuses.reduce(
      (acc, cur) =>
        Object.assign(acc, {
          [`${cur.did}/${cur.recordPath}` ?? '']: this.subjectStatus(cur),
        }),
      {},
    )

    const views = results.map((res) => {
      const repo = reposByDid[didFromUri(res.uri)]
      const { did, recordPath } = didAndRecordPathFromUri(res.uri)
      const subjectStatus = subjectStatusByUri[`${did}/${recordPath}`]
      if (!repo) throw new Error(`Record repo is missing: ${res.uri}`)
      const value = jsonStringToLex(res.json) as Record<string, unknown>
      return {
        uri: res.uri,
        cid: res.cid,
        value,
        blobCids: findBlobRefs(value).map((blob) => blob.ref.toString()),
        indexedAt: res.indexedAt,
        repo,
        moderation: {
          subjectStatus,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  async recordDetail(result: RecordResult): Promise<RecordViewDetail> {
    const [record, subjectStatusResult] = await Promise.all([
      this.record(result),
      this.getSubjectStatus(didAndRecordPathFromUri(result.uri)),
    ])

    const [blobs, labels, subjectStatus] = await Promise.all([
      this.blob(findBlobRefs(record.value)),
      this.labels(record.uri),
      subjectStatusResult?.length
        ? this.subjectStatus(subjectStatusResult[0])
        : Promise.resolve(undefined),
    ])
    const selfLabels = getSelfLabels({
      uri: result.uri,
      cid: result.cid,
      record: jsonStringToLex(result.json) as Record<string, unknown>,
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
  reportPublic(report: ReportResult): ReportOutput {
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
      subject:
        report.subjectType === 'com.atproto.admin.defs#repoRef'
          ? {
              $type: 'com.atproto.admin.defs#repoRef',
              did: report.subjectDid,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: report.subjectUri,
              cid: report.subjectCid,
            },
    }
  }
  // Partial view for subjects

  async subject(result: SubjectResult): Promise<SubjectView> {
    let subject: SubjectView
    if (result.subjectType === 'com.atproto.admin.defs#repoRef') {
      const repoResult = await this.db.db
        .selectFrom('actor')
        .selectAll()
        .where('did', '=', result.subjectDid)
        .executeTakeFirst()
      if (repoResult) {
        subject = await this.repo(repoResult)
        subject.$type = 'com.atproto.admin.defs#repoView'
      } else {
        subject = { did: result.subjectDid }
        subject.$type = 'com.atproto.admin.defs#repoViewNotFound'
      }
    } else if (
      result.subjectType === 'com.atproto.repo.strongRef' &&
      result.subjectUri !== null
    ) {
      const recordResult = await this.db.db
        .selectFrom('record')
        .selectAll()
        .where('uri', '=', result.subjectUri)
        .executeTakeFirst()
      if (recordResult) {
        subject = await this.record(recordResult)
        subject.$type = 'com.atproto.admin.defs#recordView'
      } else {
        subject = { uri: result.subjectUri }
        subject.$type = 'com.atproto.admin.defs#recordViewNotFound'
      }
    } else {
      throw new Error(`Bad subject data: (${result.id}) ${result.subjectType}`)
    }
    return subject
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
        ? this.subjectStatus(statusByCid[cid])
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
    subject:
      | { did: string; recordPath?: string }
      | { did: string; recordPath?: string }[],
  ): Promise<ModerationSubjectStatusRowWithHandle[]> {
    const subjectFilters = Array.isArray(subject) ? subject : [subject]
    const filterForSubject =
      ({ did, recordPath }: { did: string; recordPath?: string }) =>
      // TODO: Fix the typing here?
      (clause: any) => {
        clause = clause
          .where('moderation_subject_status.did', '=', did)
          .where('moderation_subject_status.recordPath', '=', recordPath || '')
        return clause
      }

    const builder = this.db.db
      .selectFrom('moderation_subject_status')
      .leftJoin('actor', 'actor.did', 'moderation_subject_status.did')
      .where((clause) => {
        subjectFilters.forEach(({ did, recordPath }, i) => {
          const applySubjectFilter = filterForSubject({ did, recordPath })
          if (i === 0) {
            clause = clause.where(applySubjectFilter)
          } else {
            clause = clause.orWhere(applySubjectFilter)
          }
        })

        return clause
      })
      .selectAll('moderation_subject_status')
      .select('actor.handle as handle')

    return builder.execute()
  }

  subjectStatus(result: ModerationSubjectStatusRowWithHandle): SubjectStatusView
  subjectStatus(
    result: ModerationSubjectStatusRowWithHandle[],
  ): SubjectStatusView[]
  subjectStatus(
    result:
      | ModerationSubjectStatusRowWithHandle
      | ModerationSubjectStatusRowWithHandle[],
  ): SubjectStatusView | SubjectStatusView[] {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const decoratedSubjectStatuses = results.map((subjectStatus) => ({
      id: subjectStatus.id,
      reviewState: subjectStatus.reviewState,
      createdAt: subjectStatus.createdAt,
      updatedAt: subjectStatus.updatedAt,
      comment: subjectStatus.comment ?? undefined,
      lastReviewedBy: subjectStatus.lastReviewedBy ?? undefined,
      lastReviewedAt: subjectStatus.lastReviewedAt ?? undefined,
      lastReportedAt: subjectStatus.lastReportedAt ?? undefined,
      muteUntil: subjectStatus.muteUntil ?? undefined,
      suspendUntil: subjectStatus.suspendUntil ?? undefined,
      takendown: subjectStatus.takendown ?? undefined,
      subjectRepoHandle: subjectStatus.handle ?? undefined,
      subjectBlobCids: subjectStatus.blobCids || [],
      subject: !subjectStatus.recordPath
        ? {
            $type: 'com.atproto.admin.defs#repoRef',
            did: subjectStatus.did,
          }
        : {
            $type: 'com.atproto.repo.strongRef',
            uri: AtUri.make(
              subjectStatus.did,
              // Not too intuitive but the recordpath is basically <collection>/<rkey>
              // which is what the last 2 params of .make() arguments are
              ...subjectStatus.recordPath.split('/'),
            ).toString(),
            cid: subjectStatus.recordCid,
          },
    }))

    return Array.isArray(result)
      ? decoratedSubjectStatuses
      : decoratedSubjectStatuses[0]
  }
}

type RepoResult = Actor

type EventResult = ModerationEventRowWithHandle

type ReportResult = ModerationEventRowWithHandle

type RecordResult = RecordRow

type SubjectResult = Pick<
  EventResult & ReportResult,
  'id' | 'subjectType' | 'subjectDid' | 'subjectUri' | 'subjectCid'
>

type SubjectView = ModEventViewDetail['subject'] & ReportViewDetail['subject']

function didFromUri(uri: string) {
  return new AtUri(uri).host
}

function didAndRecordPathFromUri(uri: string) {
  const atUri = new AtUri(uri)
  return { did: atUri.host, recordPath: `${atUri.collection}/${atUri.rkey}` }
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
