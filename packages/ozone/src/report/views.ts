import type { Selectable } from 'kysely'
import {
  type AtUriString,
  type DidString,
  type UriString,
  asUnknown$TypedObject,
} from '@atproto/lex'
import { addAccountInfoToRepoViewDetail } from '../api/util.js'
import type { ReportStat } from '../db/schema/report_stat.js'
import { app, type com, type tools } from '../lexicons/index.js'
import type { ReportWithEvent } from '../mod-service/report.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../mod-service/subject.js'
import type { ModerationSubjectStatusRowWithHandle } from '../mod-service/types.js'
import type { ParsedLabelers } from '../util.js'

type ReportViews = {
  repoDetails(
    dids: DidString[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, tools.ozone.moderation.defs.RepoView>>
  recordDetails(
    subjects: { uri: AtUriString }[],
    labelers?: ParsedLabelers,
  ): Promise<Map<string, tools.ozone.moderation.defs.RecordViewDetail>>
  getProfiles(
    dids: DidString[],
  ): Promise<Map<string, app.bsky.actor.defs.ProfileViewDetailed>>
  getSubjectStatus(
    subjects: (UriString | DidString)[],
  ): Promise<Map<string, ModerationSubjectStatusRowWithHandle>>
  formatSubjectStatus(
    status: ModerationSubjectStatusRowWithHandle,
  ): tools.ozone.moderation.defs.SubjectStatusView
}

export type HydratedReport = {
  partialRepos: Map<string, tools.ozone.moderation.defs.RepoView>
  accountInfo: Map<string, com.atproto.admin.defs.AccountView | null>
  recordInfo: Map<string, tools.ozone.moderation.defs.RecordViewDetail>
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
  queues: Map<number, tools.ozone.queue.defs.QueueView>
  memberViews: Map<string, tools.ozone.team.defs.Member>
  convoStatuses: Map<string, tools.ozone.moderation.defs.SubjectStatusView>
}

export async function hydrateReportInfo(
  reports: ReportWithEvent[],
  views: ReportViews,
  getAccountInfos: (
    dids: DidString[],
  ) => Promise<Map<string, com.atproto.admin.defs.AccountView | null>>,
  getQueues: (
    queueIds: number[],
  ) => Promise<Map<number, tools.ozone.queue.defs.QueueView>>,
  getTeamMembers: (
    dids: DidString[],
  ) => Promise<Map<string, tools.ozone.team.defs.Member>>,
  labelers: ParsedLabelers,
): Promise<HydratedReport> {
  // populate data to fetch
  const dids = new Set<DidString>()
  const uris = new Set<string>()
  const convoUris = new Set<AtUriString>()
  const queueIds = new Set<number>()
  const assignmentDids: DidString[] = []
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
      tools.ozone.moderation.defs.SubjectStatusView
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
      Array.from(uris).map((uri) => ({ uri: uri as AtUriString })),
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
  actions?: tools.ozone.moderation.defs.ModEventView[],
): tools.ozone.report.defs.ReportView {
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
  const subject: UriString | DidString = isRecord
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
    subject: {
      type: isRecord
        ? ('record' as const)
        : isChat
          ? ('chat' as const)
          : ('account' as const),
      subject,
      repo,
      record,
      profile: profile
        ? asUnknown$TypedObject(
            app.bsky.actor.defs.profileViewDetailed.$build(profile),
          )
        : undefined,
      status: subjectStatus,
    },
    reportType,
    reportedBy: report.reportedBy,
    reporter: {
      type: 'account' as const,
      subject: reporterDid,
      repo: reporterRepo,
      profile: reporterProfile
        ? asUnknown$TypedObject(
            app.bsky.actor.defs.profileViewDetailed.$build(reporterProfile),
          )
        : undefined,
      status: reporterStatus,
    },
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
): tools.ozone.queue.defs.QueueStats {
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
): tools.ozone.report.defs.LiveStats {
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
): tools.ozone.report.defs.HistoricalStats {
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
