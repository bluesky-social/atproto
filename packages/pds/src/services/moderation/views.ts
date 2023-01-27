import { Selectable } from 'kysely'
import { cborBytesToRecord } from '@atproto/common'
import { AtUri } from '@atproto/uri'
import Database from '../../db'
import { MessageQueue } from '../../event-stream/types'
import { DidHandle } from '../../db/tables/did-handle'
import { RepoRoot } from '../../db/tables/repo-root'
import {
  View as RepoView,
  ViewDetail as RepoViewDetail,
} from '../../lexicon/types/com/atproto/admin/repo'
import {
  View as RecordView,
  ViewDetail as RecordViewDetail,
} from '../../lexicon/types/com/atproto/admin/record'
import {
  View as ActionView,
  ViewDetail as ActionViewDetail,
} from '../../lexicon/types/com/atproto/admin/moderationAction'
import {
  View as ReportView,
  ViewDetail as ReportViewDetail,
} from '../../lexicon/types/com/atproto/admin/moderationReport'
import { OutputSchema as ReportOutput } from '../../lexicon/types/com/atproto/report/create'
import { ModerationAction, ModerationReport } from '../../db/tables/moderation'
import { ActorService } from '../actor'
import { RecordService } from '../record'

export class ModerationViews {
  constructor(private db: Database, private messageQueue: MessageQueue) {}

  services = {
    actor: ActorService.creator(),
    record: RecordService.creator(this.messageQueue),
  }

  repo(result: RepoResult): Promise<RepoView>
  repo(result: RepoResult[]): Promise<RepoView[]>
  async repo(
    result: RepoResult | RepoResult[],
  ): Promise<RepoView | RepoView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const info = await this.db.db
      .selectFrom('did_handle')
      .leftJoin('user', 'user.handle', 'did_handle.handle')
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .leftJoin(
        'ipld_block as profile_block',
        'profile_block.cid',
        'profile.cid',
      )
      .leftJoin(
        'ipld_block as declaration_block',
        'declaration_block.cid',
        'did_handle.declarationCid',
      )
      .where(
        'did_handle.did',
        'in',
        results.map((r) => r.did),
      )
      .select([
        'did_handle.did as did',
        'user.email as email',
        'profile_block.content as profileBytes',
        'declaration_block.content as declarationBytes',
      ])
      .execute()

    const infoByDid = info.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof info>>,
    )

    const views = results.map((r) => {
      const { email, declarationBytes, profileBytes } = infoByDid[r.did] ?? {}
      const relatedRecords: object[] = []
      if (declarationBytes) {
        relatedRecords.push(cborBytesToRecord(declarationBytes))
      }
      if (profileBytes) {
        relatedRecords.push(cborBytesToRecord(profileBytes))
      }
      return {
        did: r.did,
        handle: r.handle,
        account: email ? { email } : undefined,
        relatedRecords,
        indexedAt: r.indexedAt,
        moderation: { takedownId: r.takedownId ?? undefined },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  async repoDetail(result: RepoResult): Promise<RepoViewDetail> {
    const repo = await this.repo(result)
    const [reportResults, actionResults] = await Promise.all([
      this.db.db
        .selectFrom('moderation_report')
        .where('subjectType', '=', 'com.atproto.repo.repoRef')
        .where('subjectDid', '=', repo.did)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
      this.db.db
        .selectFrom('moderation_action')
        .where('subjectType', '=', 'com.atproto.repo.repoRef')
        .where('subjectDid', '=', repo.did)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
    ])
    const [reports, actions] = await Promise.all([
      this.report(reportResults),
      this.action(actionResults),
    ])
    return {
      ...repo,
      moderation: {
        ...repo.moderation,
        reports,
        actions,
      },
    }
  }

  record(result: RecordResult): Promise<RecordView>
  record(result: RecordResult[]): Promise<RecordView[]>
  async record(
    result: RecordResult | RecordResult[],
  ): Promise<RecordView | RecordView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const repoResults = await this.db.db
      .selectFrom('repo_root')
      .innerJoin('did_handle', 'did_handle.did', 'repo_root.did')
      .where(
        'repo_root.did',
        'in',
        results.map((r) => didFromUri(r.uri)),
      )
      .selectAll('repo_root')
      .selectAll('did_handle')
      .execute()
    const repos = await this.repo(repoResults)
    const reposByDid = repos.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof repos>>,
    )

    const views = results.map((res) => {
      const repo = reposByDid[didFromUri(res.uri)]
      if (!repo) throw new Error(`Record repo is missing: ${res.uri}`)
      return {
        uri: res.uri,
        cid: res.cid,
        value: res.value,
        indexedAt: res.indexedAt,
        repo,
        moderation: {
          takedownId: res.takedownId ?? undefined,
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
        .where('subjectType', '=', 'com.atproto.repo.recordRef')
        .where('subjectUri', '=', result.uri)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
      this.db.db
        .selectFrom('moderation_action')
        .where('subjectType', '=', 'com.atproto.repo.recordRef')
        .where('subjectUri', '=', result.uri)
        .orderBy('id', 'desc')
        .selectAll()
        .execute(),
    ])
    const [reports, actions] = await Promise.all([
      this.report(reportResults),
      this.action(actionResults),
    ])
    return {
      ...record,
      moderation: {
        ...record.moderation,
        reports,
        actions,
      },
    }
  }

  action(result: ActionResult): Promise<ActionView>
  action(result: ActionResult[]): Promise<ActionView[]>
  async action(
    result: ActionResult | ActionResult[],
  ): Promise<ActionView | ActionView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const resolutions = await this.db.db
      .selectFrom('moderation_report_resolution')
      .select(['reportId as id', 'actionId'])
      .where(
        'actionId',
        'in',
        results.map((r) => r.id),
      )
      .orderBy('id', 'desc')
      .execute()

    const reportIdsByActionId = resolutions.reduce((acc, cur) => {
      acc[cur.actionId] ??= []
      acc[cur.actionId].push(cur.id)
      return acc
    }, {} as Record<string, number[]>)

    const views = results.map((res) => ({
      id: res.id,
      action: res.action,
      subject:
        res.subjectType === 'com.atproto.repo.repoRef'
          ? {
              $type: 'com.atproto.repo.repoRef',
              did: res.subjectDid,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: res.subjectUri,
              cid: res.subjectCid,
            },
      reason: res.reason,
      createdAt: res.createdAt,
      createdBy: res.createdBy,
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
    return {
      id: action.id,
      action: action.action,
      subject,
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
      reportedByDid: res.reportedByDid,
      subject:
        res.subjectType === 'com.atproto.repo.repoRef'
          ? {
              $type: 'com.atproto.repo.repoRef',
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
      reportedByDid: report.reportedByDid,
      subject:
        report.subjectType === 'com.atproto.repo.repoRef'
          ? {
              $type: 'com.atproto.repo.repoRef',
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
      reportedByDid: report.reportedByDid,
      subject,
      resolvedByActions,
    }
  }

  // Partial view for subjects

  async subject(result: SubjectResult): Promise<SubjectView> {
    let subject: SubjectView
    if (result.subjectType === 'com.atproto.repo.repoRef') {
      const repoResult = await this.services
        .actor(this.db)
        .getUser(result.subjectDid, true)
      if (!repoResult) {
        throw new Error(
          `Subject is missing: (${result.id}) ${result.subjectDid}`,
        )
      }
      subject = await this.repo(repoResult)
      subject.$type = 'com.atproto.admin.repo#view'
    } else if (
      result.subjectType === 'com.atproto.repo.recordRef' &&
      result.subjectUri !== null
    ) {
      const recordResult = await this.services
        .record(this.db)
        .getRecord(new AtUri(result.subjectUri), null, true)
      if (!recordResult) {
        throw new Error(
          `Subject is missing: (${result.id}) ${result.subjectUri}`,
        )
      }
      subject = await this.record(recordResult)
      subject.$type = 'com.atproto.admin.record#view'
    } else {
      throw new Error(`Bad subject data: (${result.id}) ${result.subjectType}`)
    }
    return subject
  }
}

type RepoResult = DidHandle & RepoRoot

type ActionResult = Selectable<ModerationAction>

type ReportResult = Selectable<ModerationReport>

type RecordResult = {
  uri: string
  cid: string
  value: object
  indexedAt: string
  takedownId: number | null
}

type SubjectResult = Pick<
  ActionResult & ReportResult,
  'id' | 'subjectType' | 'subjectDid' | 'subjectUri' | 'subjectCid'
>

type SubjectView = ActionViewDetail['subject'] & ReportViewDetail['subject']

type ArrayEl<A> = A extends readonly (infer T)[] ? T : never

function didFromUri(uri: string) {
  return new AtUri(uri).host
}
