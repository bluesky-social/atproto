import { Selectable } from 'kysely'
import { ArrayEl, cborBytesToRecord } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import Database from '../../db'
import { DidHandle } from '../../db/tables/did-handle'
import { RepoRoot } from '../../db/tables/repo-root'
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
import { ModerationAction } from '../../db/tables/moderation'
import { AccountService } from '../account'
import { RecordService } from '../record'
import { ModerationReportRowWithHandle } from '.'
import { ids } from '../../lexicon/lexicons'

export class ModerationViews {
  constructor(private db: Database) {}

  services = {
    account: AccountService.creator(),
    record: RecordService.creator(),
  }

  repo(result: RepoResult, opts: ModViewOptions): Promise<RepoView>
  repo(result: RepoResult[], opts: ModViewOptions): Promise<RepoView[]>
  async repo(
    result: RepoResult | RepoResult[],
    opts: ModViewOptions,
  ): Promise<RepoView | RepoView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [info, actionResults, invitedBy] = await Promise.all([
      await this.db.db
        .selectFrom('did_handle')
        .leftJoin('user_account', 'user_account.did', 'did_handle.did')
        .leftJoin('record as profile_record', (join) =>
          join
            .onRef('profile_record.did', '=', 'did_handle.did')
            .on('profile_record.collection', '=', ids.AppBskyActorProfile)
            .on('profile_record.rkey', '=', 'self'),
        )
        .leftJoin('ipld_block as profile_block', (join) =>
          join
            .onRef('profile_block.cid', '=', 'profile_record.cid')
            .onRef('profile_block.creator', '=', 'did_handle.did'),
        )
        .where(
          'did_handle.did',
          'in',
          results.map((r) => r.did),
        )
        .select([
          'did_handle.did as did',
          'user_account.email as email',
          'user_account.invitesDisabled as invitesDisabled',
          'user_account.inviteNote as inviteNote',
          'profile_block.content as profileBytes',
        ])
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
        .select(['id', 'action', 'durationInHours', 'subjectDid'])
        .execute(),
      this.services
        .account(this.db)
        .getInvitedByForAccounts(results.map((r) => r.did)),
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
      const { email, invitesDisabled, profileBytes, inviteNote } =
        infoByDid[r.did] ?? {}
      const action = actionByDid[r.did]
      const relatedRecords: object[] = []
      if (profileBytes) {
        relatedRecords.push(cborBytesToRecord(profileBytes))
      }
      return {
        did: r.did,
        handle: r.handle,
        email: opts.includeEmails && email ? email : undefined,
        relatedRecords,
        indexedAt: r.indexedAt,
        moderation: {
          currentAction: action
            ? {
                id: action.id,
                action: action.action,
                durationInHours: action.durationInHours ?? undefined,
              }
            : undefined,
        },
        invitedBy: invitedBy[r.did],
        invitesDisabled: invitesDisabled === 1,
        inviteNote: inviteNote ?? undefined,
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  async repoDetail(
    result: RepoResult,
    opts: ModViewOptions,
  ): Promise<RepoViewDetail> {
    const repo = await this.repo(result, opts)
    const [reportResults, actionResults, inviteCodes] = await Promise.all([
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
      this.services.account(this.db).getAccountInviteCodes(repo.did),
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
      invites: inviteCodes,
    }
  }

  record(result: RecordResult, opts: ModViewOptions): Promise<RecordView>
  record(result: RecordResult[], opts: ModViewOptions): Promise<RecordView[]>
  async record(
    result: RecordResult | RecordResult[],
    opts: ModViewOptions,
  ): Promise<RecordView | RecordView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [repoResults, blobResults, actionResults] = await Promise.all([
      this.db.db
        .selectFrom('repo_root')
        .innerJoin('did_handle', 'did_handle.did', 'repo_root.did')
        .where(
          'repo_root.did',
          'in',
          results.map((r) => didFromUri(r.uri)),
        )
        .selectAll('repo_root')
        .selectAll('did_handle')
        .execute(),
      this.db.db
        .selectFrom('repo_blob')
        .where(
          'recordUri',
          'in',
          results.map((r) => r.uri),
        )
        .select(['cid', 'recordUri'])
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
        .select(['id', 'action', 'durationInHours', 'subjectUri'])
        .execute(),
    ])
    const repos = await this.repo(repoResults, opts)

    const reposByDid = repos.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof repos>>,
    )
    const blobCidsByUri = blobResults.reduce((acc, cur) => {
      acc[cur.recordUri] ??= []
      acc[cur.recordUri].push(cur.cid)
      return acc
    }, {} as Record<string, string[]>)
    const actionByUri = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.subjectUri ?? '']: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )

    const views = results.map((res) => {
      const repo = reposByDid[didFromUri(res.uri)]
      const action = actionByUri[res.uri]
      if (!repo) throw new Error(`Record repo is missing: ${res.uri}`)
      return {
        uri: res.uri,
        cid: res.cid,
        value: res.value,
        blobCids: blobCidsByUri[res.uri] ?? [],
        indexedAt: res.indexedAt,
        repo,
        moderation: {
          currentAction: action
            ? {
                id: action.id,
                action: action.action,
                durationInHours: action.durationInHours ?? undefined,
              }
            : undefined,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  async recordDetail(
    result: RecordResult,
    opts: ModViewOptions,
  ): Promise<RecordViewDetail> {
    const [record, reportResults, actionResults] = await Promise.all([
      this.record(result, opts),
      this.db.db
        .selectFrom('moderation_report')
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where('subjectUri', '=', result.uri)
        .leftJoin(
          'did_handle',
          'did_handle.did',
          'moderation_report.subjectDid',
        )
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
    const [reports, actions, blobs] = await Promise.all([
      this.report(reportResults),
      this.action(actionResults),
      this.blob(record.blobCids),
    ])
    return {
      ...record,
      blobs,
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
      durationInHours: res.durationInHours ?? undefined,
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

  async actionDetail(
    result: ActionResult,
    opts: ModViewOptions,
  ): Promise<ActionViewDetail> {
    const action = await this.action(result)
    const reportResults = action.resolvedReportIds.length
      ? await this.db.db
          .selectFrom('moderation_report')
          .where('id', 'in', action.resolvedReportIds)
          .orderBy('id', 'desc')
          .selectAll()
          .execute()
      : []
    const [subject, resolvedReports, subjectBlobs] = await Promise.all([
      this.subject(result, opts),
      this.report(reportResults),
      this.blob(action.subjectBlobCids),
    ])
    return {
      id: action.id,
      action: action.action,
      durationInHours: action.durationInHours,
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

    const views: ReportView[] = results.map((res) => {
      const decoratedView: ReportView = {
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
      }

      if (res.handle) {
        decoratedView.subjectRepoHandle = res.handle
      }

      return decoratedView
    })

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

  async reportDetail(
    result: ReportResult,
    opts: ModViewOptions,
  ): Promise<ReportViewDetail> {
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
      this.subject(result, opts),
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

  async subject(
    result: SubjectResult,
    opts: ModViewOptions,
  ): Promise<SubjectView> {
    let subject: SubjectView
    if (result.subjectType === 'com.atproto.admin.defs#repoRef') {
      const repoResult = await this.services
        .account(this.db)
        .getAccount(result.subjectDid, true)
      if (repoResult) {
        subject = await this.repo(repoResult, opts)
        subject.$type = 'com.atproto.admin.defs#repoView'
      } else {
        subject = { did: result.subjectDid }
        subject.$type = 'com.atproto.admin.defs#repoViewNotFound'
      }
    } else if (
      result.subjectType === 'com.atproto.repo.strongRef' &&
      result.subjectUri !== null
    ) {
      const recordResult = await this.services
        .record(this.db)
        .getRecord(new AtUri(result.subjectUri), null, true)
      if (recordResult) {
        subject = await this.record(recordResult, opts)
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

  async blob(cids: string[]): Promise<BlobView[]> {
    if (!cids.length) return []
    const [blobResults, actionResults] = await Promise.all([
      this.db.db
        .selectFrom('blob')
        .where('cid', 'in', cids)
        .selectAll()
        .execute(),
      this.db.db
        .selectFrom('moderation_action')
        .where('reversedAt', 'is', null)
        .innerJoin(
          'moderation_action_subject_blob as subject_blob',
          'subject_blob.actionId',
          'moderation_action.id',
        )
        .select(['id', 'action', 'durationInHours', 'cid'])
        .execute(),
    ])
    const actionByCid = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.cid]: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )
    return blobResults.map((result) => {
      const action = actionByCid[result.cid]
      return {
        cid: result.cid,
        mimeType: result.mimeType,
        size: result.size,
        createdAt: result.createdAt,
        // @TODO support #videoDetails here when we start tracking video length
        details:
          result.mimeType.startsWith('image/') &&
          result.height !== null &&
          result.width !== null
            ? {
                $type: 'com.atproto.admin.blob#imageDetails',
                height: result.height,
                width: result.width,
              }
            : undefined,
        moderation: {
          currentAction: action
            ? {
                id: action.id,
                action: action.action,
                durationInHours: action.durationInHours ?? undefined,
              }
            : undefined,
        },
      }
    })
  }
}

type RepoResult = DidHandle & RepoRoot

type ActionResult = Selectable<ModerationAction>

type ReportResult = ModerationReportRowWithHandle

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

function didFromUri(uri: string) {
  return new AtUri(uri).host
}

export type ModViewOptions = { includeEmails: boolean }
