import { Selectable } from 'kysely'
import { ipldBytesToRecord } from '@atproto/common'
import Database from '../../db'
import { DidHandle } from '../../db/tables/did-handle'
import { RepoRoot } from '../../db/tables/repo-root'
import { View as RepoView } from '../../lexicon/types/com/atproto/admin/repo'
import { View as ActionView } from '../../lexicon/types/com/atproto/admin/moderationAction'
import { View as ReportView } from '../../lexicon/types/com/atproto/admin/moderationReport'
import { OutputSchema as ReportOutput } from '../../lexicon/types/com/atproto/report/create'
import { ModerationAction, ModerationReport } from '../../db/tables/moderation'

export class ModerationViews {
  constructor(private db: Database) {}

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
        relatedRecords.push(ipldBytesToRecord(declarationBytes))
      }
      if (profileBytes) {
        relatedRecords.push(ipldBytesToRecord(profileBytes))
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
      .orderBy('createdAt', 'desc')
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
      .orderBy('createdAt', 'desc')
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
}

type RepoResult = DidHandle & RepoRoot

type ActionResult = Selectable<ModerationAction>

type ReportResult = Selectable<ModerationReport>

type ArrayEl<A> = A extends readonly (infer T)[] ? T : never
