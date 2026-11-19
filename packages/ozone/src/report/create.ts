import type { Insertable } from 'kysely'
import { AtUri } from '@atproto/syntax'
import type { Report } from '../db/schema/report.js'
import { com } from '../lexicons/index.js'
import type { ModerationEventRow } from '../mod-service/types.js'

type ReportEvent = Pick<
  ModerationEventRow,
  | 'id'
  | 'createdBy'
  | 'createdAt'
  | 'subjectDid'
  | 'subjectUri'
  | 'subjectMessageId'
  | 'subjectConvoId'
  | 'meta'
  | 'modTool'
>

/** Build a pending report with the immutable fields from its source event. */
export function reportRowFromEvent(event: ReportEvent): Insertable<Report> {
  const uri = event.subjectUri ? new AtUri(event.subjectUri) : null
  return {
    eventId: event.id,
    reporterDid: event.createdBy,
    queueId: null,
    queuedAt: null,
    status: 'open',
    actionEventIds: null,
    actionNote: null,
    isMuted: !!event.meta?.isReporterMuted || !!event.meta?.isSubjectMuted,
    isAutomated: event.modTool?.meta?.isAutomated === true,
    reportType:
      (event.meta?.reportType as string | undefined) ??
      com.atproto.moderation.defs.ReasonOther,
    priorityLevel: null,
    priorityScore: null,
    priorityTargetMinutes: null,
    did: event.subjectDid,
    recordPath: uri ? `${uri.collection}/${uri.rkey}` : '',
    subjectMessageId: event.subjectMessageId,
    subjectConvoId: event.subjectConvoId,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
    assignedTo: null,
    assignedAt: null,
    closedAt: null,
  }
}
