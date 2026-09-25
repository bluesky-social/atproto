import type { DatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import type { InboxNotification } from '../db/schema/inbox_notification.js'
import { APPEAL_REASON_TYPE } from '../inbox/appeal.js'
import { createInboxNotification } from '../inbox/notifications.js'

/** Only the report author receives report activity; appeal resolutions belong
 * to the moderated subject section. All values are snapshots taken in the
 * transaction which changed the report. */
export async function notifyReportActivities(
  db: Database,
  activities: {
    reportId: number
    activityId: number
    activityType: string
    publicNote?: string | null
    createdAt: DatetimeString
  }[],
) {
  if (!activities.length) return
  const reports = await db.db
    .selectFrom('report as r')
    .innerJoin('moderation_event as e', 'e.id', 'r.eventId')
    .where(
      'r.id',
      'in',
      activities.map((activity) => activity.reportId),
    )
    .select([
      'r.id as reportId',
      'r.eventId',
      'r.reportType',
      'r.status',
      'e.createdBy',
      'e.subjectDid',
      'e.subjectUri',
      'e.subjectCid',
    ])
    .execute()
  const byId = new Map(reports.map((report) => [report.reportId, report]))

  for (const activity of activities) {
    const report = byId.get(activity.reportId)
    if (!report) continue
    const subject =
      report.subjectUri && report.subjectCid
        ? {
            $type: 'com.atproto.repo.strongRef' as const,
            uri: report.subjectUri,
            cid: report.subjectCid,
          }
        : {
            $type: 'com.atproto.admin.defs#repoRef' as const,
            did: report.subjectDid,
          }
    const isAppeal = report.reportType === APPEAL_REASON_TYPE
    const target: InboxNotification['target'] = isAppeal
      ? { $type: 'tools.ozone.inbox.defs#subjectRef', subject }
      : {
          $type: 'tools.ozone.inbox.defs#reportRef',
          reportId: report.eventId,
          subject,
          status: report.status === 'closed' ? 'resolved' : 'pending',
        }
    const emit = async (reason: string) => {
      await createInboxNotification(db, {
        recipientDid: report.createdBy,
        reason,
        target,
        body:
          reason === 'reportNote' || reason === 'appealResolved'
            ? activity.publicNote
            : undefined,
        sourceKey: `report-activity:${activity.activityId}:${reason}`,
        createdAt: activity.createdAt,
      })
    }
    if (activity.activityType === 'closeActivity') {
      await emit(isAppeal ? 'appealResolved' : 'reportResolved')
    } else if (activity.activityType === 'reopenActivity' && !isAppeal) {
      await emit('reportReopened')
    }
    if (activity.publicNote && !isAppeal) await emit('reportNote')
  }
}
