import { Selectable } from 'kysely'
import {
  AppBskyActorDefs,
  ToolsOzoneQueueDefs,
  ToolsOzoneReportDefs,
} from '@atproto/api'
import { addAccountInfoToRepoViewDetail } from '../api/util'
import { ReportStat } from '../db/schema/report_stat'
import { AccountView } from '../lexicon/types/com/atproto/admin/defs'
import {
  RecordViewDetail,
  RepoView,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { Member as TeamMember } from '../lexicon/types/tools/ozone/team/defs'
import { ReportWithEvent } from '../mod-service/report'
import { ParsedLabelers } from '../util'

type ReportViews = {
  repoDetails(
    dids: string[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, RepoView>>
  recordDetails(
    subjects: { uri: string }[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, RecordViewDetail>>
  getProfiles(
    dids: string[],
  ): Promise<Map<string, AppBskyActorDefs.ProfileViewDetailed>>
}

export type HydratedReport = {
  partialRepos: Map<string, RepoView>
  accountInfo: Map<string, AccountView | null>
  recordInfo: Map<string, RecordViewDetail>
  profiles: Map<string, AppBskyActorDefs.ProfileViewDetailed>
  queues: Map<number, ToolsOzoneQueueDefs.QueueView>
  memberViews: Map<string, TeamMember>
}

export async function hydrateReportInfo(
  reports: ReportWithEvent[],
  views: ReportViews,
  getAccountInfos: (dids: string[]) => Promise<Map<string, AccountView | null>>,
  getQueues: (
    queueIds: number[],
  ) => Promise<Map<number, ToolsOzoneQueueDefs.QueueView>>,
  getTeamMembers: (dids: string[]) => Promise<Map<string, TeamMember>>,
  labelers: ParsedLabelers,
): Promise<HydratedReport> {
  const dids = new Set<string>()
  const uris = new Set<string>()
  const queueIds = new Set<number>()
  const assignmentDids: string[] = []

  for (const report of reports) {
    dids.add(report.subjectDid)
    dids.add(report.reportedBy)
    if (report.subjectUri) uris.add(report.subjectUri)
    if (report.queueId && report.queueId > 0) queueIds.add(report.queueId)
    if (report.assignedTo) {
      dids.add(report.assignedTo)
      assignmentDids.push(report.assignedTo)
    }
  }

  const didsArray = Array.from(dids)
  const [partialRepos, accountInfo, recordInfo, profiles, queues, memberViews] =
    await Promise.all([
      views.repoDetails(didsArray, labelers),
      getAccountInfos(didsArray),
      views.recordDetails(
        Array.from(uris).map((uri) => ({ uri })),
        labelers,
      ),
      views.getProfiles(didsArray),
      getQueues(Array.from(queueIds)),
      getTeamMembers(assignmentDids),
    ])

  return {
    partialRepos,
    accountInfo,
    recordInfo,
    profiles,
    queues,
    memberViews,
  }
}

export function buildReportView(
  report: ReportWithEvent,
  hydrated: HydratedReport,
  isModerator: boolean,
) {
  const {
    partialRepos,
    accountInfo,
    recordInfo,
    profiles,
    queues,
    memberViews,
  } = hydrated
  const isRecord = !!report.subjectUri
  const did = report.subjectDid
  const partialRepo = partialRepos.get(did)
  const repo = partialRepo
    ? addAccountInfoToRepoViewDetail(
        partialRepo,
        accountInfo.get(did) || null,
        isModerator,
      )
    : undefined
  const profile = profiles.get(did)
  const record = isRecord ? recordInfo.get(report.subjectUri!) : undefined
  const status = isRecord
    ? record?.moderation.subjectStatus
    : repo?.moderation.subjectStatus

  const reportType = report.meta?.reportType as string

  const subject = isRecord ? report.subjectUri! : report.subjectDid
  const subjectView = {
    type: isRecord ? 'record' : 'account',
    subject,
    repo,
    record,
    profile: profile
      ? {
          $type: 'app.bsky.actor.defs#profileViewDetailed' as const,
          ...profile,
        }
      : undefined,
    status,
  }

  const reporterDid = report.reportedBy
  const reporterPartialRepo = partialRepos.get(reporterDid)
  const reporterRepo = reporterPartialRepo
    ? addAccountInfoToRepoViewDetail(
        reporterPartialRepo,
        accountInfo.get(reporterDid) || null,
        isModerator,
      )
    : undefined
  const reporterProfile = profiles.get(reporterDid)
  const reporterStatus = reporterRepo?.moderation.subjectStatus

  const reporterView = {
    type: 'account',
    subject: reporterDid,
    repo: reporterRepo,
    profile: reporterProfile
      ? {
          $type: 'app.bsky.actor.defs#profileViewDetailed' as const,
          ...reporterProfile,
        }
      : undefined,
    status: reporterStatus,
  }

  const assignmentView =
    report.assignedTo && report.assignedAt
      ? {
          did: report.assignedTo,
          moderator: memberViews.get(report.assignedTo),
          assignedAt: report.assignedAt,
        }
      : undefined

  return {
    id: report.id,
    eventId: report.eventId,
    status: report.status,
    subject: subjectView,
    reportType,
    reportedBy: report.reportedBy,
    reporter: reporterView,
    comment: report.comment ?? undefined,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    queuedAt: report.queuedAt ?? undefined,
    actionEventIds:
      report.actionEventIds && Array.isArray(report.actionEventIds)
        ? (report.actionEventIds as number[])
        : undefined,
    actionNote: report.actionNote ?? undefined,
    assignment: assignmentView,
    queue:
      report.queueId && report.queueId > 0
        ? queues.get(report.queueId)
        : undefined,
    isMuted: report.isMuted,
  }
}

export function viewQueueStats(
  row?: Selectable<ReportStat>,
): ToolsOzoneQueueDefs.QueueStats {
  return {
    pendingCount: row?.pendingCount ?? undefined,
    actionedCount: row?.actionedCount ?? undefined,
    escalatedCount: row?.escalatedCount ?? undefined,
    inboundCount: row?.inboundCount ?? undefined,
    actionRate: row?.actionRate ?? undefined,
    avgHandlingTimeSec: row?.avgHandlingTimeSec ?? undefined,
    lastUpdated: row?.computedAt,
  }
}

export function viewLiveStats(
  row?: Selectable<ReportStat>,
): ToolsOzoneReportDefs.LiveStats {
  return {
    pendingCount: row?.pendingCount ?? undefined,
    actionedCount: row?.actionedCount ?? undefined,
    escalatedCount: row?.escalatedCount ?? undefined,
    inboundCount: row?.inboundCount ?? undefined,
    actionRate: row?.actionRate ?? undefined,
    avgHandlingTimeSec: row?.avgHandlingTimeSec ?? undefined,
    lastUpdated: row?.computedAt,
  }
}

export function viewHistoricalStats(
  row: Selectable<ReportStat>,
): ToolsOzoneReportDefs.HistoricalStats {
  return {
    date: row.date,
    computedAt: row.computedAt,
    pendingCount: row.pendingCount ?? undefined,
    actionedCount: row.actionedCount ?? undefined,
    escalatedCount: row.escalatedCount ?? undefined,
    inboundCount: row.inboundCount ?? undefined,
    actionRate: row.actionRate ?? undefined,
    avgHandlingTimeSec: row.avgHandlingTimeSec ?? undefined,
  }
}
