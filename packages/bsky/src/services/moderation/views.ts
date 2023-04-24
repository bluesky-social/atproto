import { Selectable } from 'kysely'
import { ArrayEl } from '@atproto/common'
import { AtUri } from '@atproto/uri'
import { BlobRef, jsonStringToLex } from '@atproto/lexicon'
import Database from '../../db'
import { Actor } from '../../db/tables/actor'
import { Record as RecordRow } from '../../db/tables/record'
import { ModerationAction, ModerationReport } from '../../db/tables/moderation'
import {
  RepoView,
  RepoViewDetail,
  RecordView,
  RecordViewDetail,
  ActionView,
  ActionViewDetail,
  ReportView,
  ReportViewDetail,
  BlobView,
} from '../../lexicon/types/com/atproto/admin/defs'
import { OutputSchema as ReportOutput } from '../../lexicon/types/com/atproto/moderation/createReport'
import { Label } from '../../lexicon/types/com/atproto/label/defs'

export class ModerationViews {
  constructor(private db: Database) {}

  repo(result: RepoResult): Promise<RepoView>
  repo(result: RepoResult[]): Promise<RepoView[]>
  async repo(
    result: RepoResult | RepoResult[],
  ): Promise<RepoView | RepoView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [info, actionResults] = await Promise.all([
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
      this.db.db
        .selectFrom('moderation_action')
        .where('reversedAt', 'is', null)
        .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
        .where(
          'subjectDid',
          'in',
          results.map((r) => r.did),
        )
        .select(['id', 'action', 'subjectDid'])
        .execute(),
    ])

    const infoByDid = info.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof info>>,
    )
    const actionByDid = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.subjectDid ?? '']: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )

    const views = results.map((r) => {
      const { profileJson } = infoByDid[r.did] ?? {}
      const action = actionByDid[r.did]
      const relatedRecords: object[] = []
      if (profileJson) {
        relatedRecords.push(
          jsonStringToLex(profileJson) as Record<string, unknown>,
        )
      }
      return {
        // No email or invite info on appview
        did: r.did,
        handle: r.handle,
        relatedRecords,
        indexedAt: r.indexedAt,
        moderation: {
          currentAction: action
            ? { id: action.id, action: action.action }
            : undefined,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  async repoDetail(result: RepoResult): Promise<RepoViewDetail> {
    const repo = await this.repo(result)
    const [reportResults, actionResults] = await Promise.all([
      this.db.db
        .selectFrom('moderation_report')
        .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
        .where('subjectDid', '=', repo.did)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
      this.db.db
        .selectFrom('moderation_action')
        .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
        .where('subjectDid', '=', repo.did)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
    ])
    const [reports, actions, labels] = await Promise.all([
      this.report(reportResults),
      this.action(actionResults),
      this.labels(repo.did),
    ])
    return {
      ...repo,
      moderation: {
        ...repo.moderation,
        reports,
        actions,
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

    const [repoResults, actionResults] = await Promise.all([
      this.db.db
        .selectFrom('actor')
        .where(
          'actor.did',
          'in',
          results.map((r) => didFromUri(r.uri)),
        )
        .selectAll()
        .execute(),
      this.db.db
        .selectFrom('moderation_action')
        .where('reversedAt', 'is', null)
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where(
          'subjectUri',
          'in',
          results.map((r) => r.uri),
        )
        .select(['id', 'action', 'subjectUri'])
        .execute(),
    ])
    const repos = await this.repo(repoResults)

    const reposByDid = repos.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof repos>>,
    )
    const actionByUri = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.subjectUri ?? '']: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )

    const views = results.map((res) => {
      const repo = reposByDid[didFromUri(res.uri)]
      const action = actionByUri[res.uri]
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
          currentAction: action
            ? { id: action.id, action: action.action }
            : undefined,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  async recordDetail(result: RecordResult): Promise<RecordViewDetail> {
    const [record, reportResults, actionResults] = await Promise.all([
      this.record(result),
      this.db.db
        .selectFrom('moderation_report')
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where('subjectUri', '=', result.uri)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
      this.db.db
        .selectFrom('moderation_action')
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where('subjectUri', '=', result.uri)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
    ])
    const [reports, actions, blobs, labels] = await Promise.all([
      this.report(reportResults),
      this.action(actionResults),
      this.blob(findBlobRefs(record.value)),
      this.labels(record.uri),
    ])
    return {
      ...record,
      blobs,
      moderation: {
        ...record.moderation,
        reports,
        actions,
      },
      labels,
    }
  }

  action(result: ActionResult): Promise<ActionView>
  action(result: ActionResult[]): Promise<ActionView[]>
  async action(
    result: ActionResult | ActionResult[],
  ): Promise<ActionView | ActionView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [resolutions, subjectBlobResults] = await Promise.all([
      this.db.db
        .selectFrom('moderation_report_resolution')
        .select(['reportId as id', 'actionId'])
        .where(
          'actionId',
          'in',
          results.map((r) => r.id),
        )
        .orderBy('id', 'desc')
        .execute(),
      await this.db.db
        .selectFrom('moderation_action_subject_blob')
        .selectAll()
        .where(
          'actionId',
          'in',
          results.map((r) => r.id),
        )
        .execute(),
    ])

    const reportIdsByActionId = resolutions.reduce((acc, cur) => {
      acc[cur.actionId] ??= []
      acc[cur.actionId].push(cur.id)
      return acc
    }, {} as Record<string, number[]>)
    const subjectBlobCidsByActionId = subjectBlobResults.reduce((acc, cur) => {
      acc[cur.actionId] ??= []
      acc[cur.actionId].push(cur.cid)
      return acc
    }, {} as Record<string, string[]>)

    const views = results.map((res) => ({
      id: res.id,
      action: res.action,
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
      subjectBlobCids: subjectBlobCidsByActionId[res.id] ?? [],
      reason: res.reason,
      createdAt: res.createdAt,
      createdBy: res.createdBy,
      createLabelVals:
        res.createLabelVals && res.createLabelVals.length > 0
          ? res.createLabelVals.split(' ')
          : undefined,
      negateLabelVals:
        res.negateLabelVals && res.negateLabelVals.length > 0
          ? res.negateLabelVals.split(' ')
          : undefined,
      reversal:
        res.reversedAt !== null &&
        res.reversedBy !== null &&
        res.reversedReason !== null
          ? {
              createdAt: res.reversedAt,
              createdBy: res.reversedBy,
              reason: res.reversedReason,
            }
          : undefined,
      resolvedReportIds: reportIdsByActionId[res.id] ?? [],
    }))

    return Array.isArray(result) ? views : views[0]
  }

  async actionDetail(result: ActionResult): Promise<ActionViewDetail> {
    const action = await this.action(result)
    const reportResults = action.resolvedReportIds.length
      ? await this.db.db
          .selectFrom('moderation_report')
          .where('id', 'in', action.resolvedReportIds)
          .orderBy('id', 'desc')
          .selectAll()
          .execute()
      : []
    const [subject, resolvedReports] = await Promise.all([
      this.subject(result),
      this.report(reportResults),
    ])
    const allBlobs = findBlobRefs(subject.value)
    const subjectBlobs = await this.blob(
      allBlobs.filter((blob) =>
        action.subjectBlobCids.includes(blob.ref.toString()),
      ),
    )
    return {
      id: action.id,
      action: action.action,
      subject,
      subjectBlobs,
      createLabelVals: action.createLabelVals,
      negateLabelVals: action.negateLabelVals,
      reason: action.reason,
      createdAt: action.createdAt,
      createdBy: action.createdBy,
      reversal: action.reversal,
      resolvedReports,
    }
  }

  report(result: ReportResult): Promise<ReportView>
  report(result: ReportResult[]): Promise<ReportView[]>
  async report(
    result: ReportResult | ReportResult[],
  ): Promise<ReportView | ReportView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const resolutions = await this.db.db
      .selectFrom('moderation_report_resolution')
      .select(['actionId as id', 'reportId'])
      .where(
        'reportId',
        'in',
        results.map((r) => r.id),
      )
      .orderBy('id', 'desc')
      .execute()

    const actionIdsByReportId = resolutions.reduce((acc, cur) => {
      acc[cur.reportId] ??= []
      acc[cur.reportId].push(cur.id)
      return acc
    }, {} as Record<string, number[]>)

    const views: ReportView[] = results.map((res) => ({
      id: res.id,
      createdAt: res.createdAt,
      reasonType: res.reasonType,
      reason: res.reason ?? undefined,
      reportedBy: res.reportedByDid,
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
      resolvedByActionIds: actionIdsByReportId[res.id] ?? [],
    }))

    return Array.isArray(result) ? views : views[0]
  }

  reportPublic(report: ReportResult): ReportOutput {
    return {
      id: report.id,
      createdAt: report.createdAt,
      reasonType: report.reasonType,
      reason: report.reason ?? undefined,
      reportedBy: report.reportedByDid,
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

  async reportDetail(result: ReportResult): Promise<ReportViewDetail> {
    const report = await this.report(result)
    const actionResults = report.resolvedByActionIds.length
      ? await this.db.db
          .selectFrom('moderation_action')
          .where('id', 'in', report.resolvedByActionIds)
          .orderBy('id', 'desc')
          .selectAll()
          .execute()
      : []
    const [subject, resolvedByActions] = await Promise.all([
      this.subject(result),
      this.action(actionResults),
    ])
    return {
      id: report.id,
      createdAt: report.createdAt,
      reasonType: report.reasonType,
      reason: report.reason ?? undefined,
      reportedBy: report.reportedBy,
      subject,
      resolvedByActions,
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
      if (!repoResult) {
        throw new Error(
          `Subject is missing: (${result.id}) ${result.subjectDid}`,
        )
      }
      subject = await this.repo(repoResult)
      subject.$type = 'com.atproto.admin.defs#repoView'
    } else if (
      result.subjectType === 'com.atproto.repo.strongRef' &&
      result.subjectUri !== null
    ) {
      const recordResult = await this.db.db
        .selectFrom('record')
        .selectAll()
        .where('uri', '=', result.subjectUri)
        .executeTakeFirst()
      if (!recordResult) {
        throw new Error(
          `Subject is missing: (${result.id}) ${result.subjectUri}`,
        )
      }
      subject = await this.record(recordResult)
      subject.$type = 'com.atproto.admin.defs#recordView'
    } else {
      throw new Error(`Bad subject data: (${result.id}) ${result.subjectType}`)
    }
    return subject
  }

  // Partial view for blobs

  async blob(blobs: BlobRef[]): Promise<BlobView[]> {
    if (!blobs.length) return []
    const actionResults = await this.db.db
      .selectFrom('moderation_action')
      .where('reversedAt', 'is', null)
      .innerJoin(
        'moderation_action_subject_blob as subject_blob',
        'subject_blob.actionId',
        'moderation_action.id',
      )
      .where(
        'subject_blob.cid',
        'in',
        blobs.map((blob) => blob.ref.toString()),
      )
      .select(['id', 'action', 'cid'])
      .execute()
    const actionByCid = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.cid]: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )
    // Intentionally missing details field, since we don't have any on appview.
    // We also don't know when the blob was created, so we use a canned creation time.
    const unknownTime = new Date(0).toISOString()
    return blobs.map((blob) => {
      const cid = blob.ref.toString()
      const action = actionByCid[cid]
      return {
        cid,
        mimeType: blob.mimeType,
        size: blob.size,
        createdAt: unknownTime,
        moderation: {
          currentAction: action
            ? { id: action.id, action: action.action }
            : undefined,
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
}

type RepoResult = Actor

type ActionResult = Selectable<ModerationAction>

type ReportResult = Selectable<ModerationReport>

type RecordResult = RecordRow

type SubjectResult = Pick<
  ActionResult & ReportResult,
  'id' | 'subjectType' | 'subjectDid' | 'subjectUri' | 'subjectCid'
>

type SubjectView = ActionViewDetail['subject'] & ReportViewDetail['subject']

function didFromUri(uri: string) {
  return new AtUri(uri).host
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
