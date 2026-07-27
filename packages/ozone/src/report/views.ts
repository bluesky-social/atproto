import type { Selectable } from 'kysely'
import type { ToolsOzoneModerationDefs } from '@atproto/api'
import { addAccountInfoToRepoViewDetail } from '../api/util.js'
import type { ReportStat } from '../db/schema/report_stat.js'
import type * as AppBskyActorDefs from '../lexicon/types/app/bsky/actor/defs.js'
import type { AccountView } from '../lexicon/types/com/atproto/admin/defs.js'
import type {
  RecordViewDetail,
  RepoView,
} from '../lexicon/types/tools/ozone/moderation/defs.js'
import type * as ToolsOzoneQueueDefs from '../lexicon/types/tools/ozone/queue/defs.js'
import type * as ToolsOzoneReportDefs from '../lexicon/types/tools/ozone/report/defs.js'
import type { Member as TeamMember } from '../lexicon/types/tools/ozone/team/defs.js'
import type { ReportWithEvent } from '../mod-service/report.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../mod-service/subject.js'
import type { ModerationSubjectStatusRowWithHandle } from '../mod-service/types.js'
import type { ParsedLabelers } from '../util.js'

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
  getSubjectStatus(
    subjects: string[],
  ): Promise<Map<string, ModerationSubjectStatusRowWithHandle>>
  formatSubjectStatus(
    status: ModerationSubjectStatusRowWithHandle,
  ): ToolsOzoneModerationDefs.SubjectStatusView
}

export type HydratedReport = {
  partialRepos: Map<string, RepoView>
  accountInfo: Map<string, AccountView | null>
  recordInfo: Map<string, RecordViewDetail>
  profiles: Map<string, AppBskyActorDefs.ProfileViewDetailed>
  queues: Map<number, ToolsOzoneQueueDefs.QueueView>
  memberViews: Map<string, TeamMember>
  convoStatuses: Map<string, ToolsOzoneModerationDefs.SubjectStatusView>
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
  // populate data to fetch
  const dids = new Set<string>()
  const uris = new Set<string>()
  const convoUris = new Set<string>()
  const queueIds = new Set<number>()
  const assignmentDids: string[] = []
  for (const report of reports) {
    dids.add(report.subjectDid)
    dids.add(report.reportedBy)
    if (report.subjectUri) uris.add(report.subjectUri)
    if (report.subjectConvoId && !report.subjectMessageId) {
      convoUris.add(
        `at://${report.subjectDid}/${CHAT_CONVO_COLLECTION}/${report.subjectConvoId}`,
      )
    }
    if (report.queueId && report.queueId > 0) queueIds.add(report.queueId)
    if (report.assignedTo) {
      dids.add(report.assignedTo)
      assignmentDids.push(report.assignedTo)
    }
  }
  const didsArray = Array.from(dids)

  // fetch data
  const getConvoStatuses = async () => {
    const rows = await views.getSubjectStatus(Array.from(convoUris))
    const statuses = new Map<
      string,
      ToolsOzoneModerationDefs.SubjectStatusView
    >()
    for (const [subject, row] of rows) {
      statuses.set(subject, views.formatSubjectStatus(row))
    }
    return statuses
  }
  const [
    partialRepos,
    accountInfo,
    recordInfo,
    profiles,
    queues,
    memberViews,
    convoStatuses,
  ] = await Promise.all([
    views.repoDetails(didsArray, labelers),
    getAccountInfos(didsArray),
    views.recordDetails(
      Array.from(uris).map((uri) => ({ uri })),
      labelers,
    ),
    views.getProfiles(didsArray),
    getQueues(Array.from(queueIds)),
    getTeamMembers(assignmentDids),
    getConvoStatuses(),
  ])

  return {
    partialRepos,
    accountInfo,
    recordInfo,
    profiles,
    queues,
    memberViews,
    convoStatuses,
  }
}

export function buildReportView(
  report: ReportWithEvent,
  hydrated: HydratedReport,
  isModerator: boolean,
  actions?: ToolsOzoneModerationDefs.ModEventView[],
): ToolsOzoneReportDefs.ReportView {
  const {
    partialRepos,
    accountInfo,
    recordInfo,
    profiles,
    queues,
    memberViews,
    convoStatuses,
  } = hydrated

  // flags
  const isRecord = !!report.subjectUri
  const isMessage = !!report.subjectMessageId
  const isConvo = !!report.subjectConvoId && !report.subjectMessageId
  const isChat = isMessage || isConvo
  const did = report.subjectDid

  // enrich
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

  // subject
  const subject = isRecord
    ? report.subjectUri!
    : isMessage
      ? `at://${report.subjectDid}/${CHAT_MESSAGE_COLLECTION}/${report.subjectMessageId}`
      : isConvo
        ? `at://${report.subjectDid}/${CHAT_CONVO_COLLECTION}/${report.subjectConvoId}`
        : report.subjectDid
  // Convos have their own subject status, keyed by synthetic at-uri. Messages
  // don't have one of their own and map to the account's subject status.
  const subjectStatus = isRecord
    ? record?.moderation.subjectStatus
    : isConvo
      ? convoStatuses.get(subject)
      : repo?.moderation.subjectStatus
  const subjectView = {
    type: isRecord ? 'record' : isChat ? 'chat' : 'account',
    subject,
    repo,
    record,
    profile: profile
      ? {
          $type: 'app.bsky.actor.defs#profileViewDetailed' as const,
          ...profile,
        }
      : undefined,
    status: subjectStatus,
  }

  // report
  const reportType = report.meta?.reportType as string
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

  // assignment
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
    actions: actions && actions.length ? actions : undefined,
    actionNote: report.actionNote ?? undefined,
    assignment: assignmentView,
    queue:
      report.queueId && report.queueId > 0
        ? queues.get(report.queueId)
        : undefined,
    isMuted: report.isMuted,
    isAutomated: report.isAutomated,
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
