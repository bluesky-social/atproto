import type { DatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import { APPEAL_REASON_TYPE } from '../inbox/appeal.js'
import { runNotificationWork } from '../inbox/notification-work.js'
import {
  type NotificationInput,
  createInboxNotifications,
} from '../inbox/notifications.js'
import { com } from '../lexicons/index.js'

export type NotifiableReportActivity = {
  reportId: number
  activityId: number
  activityType: string
  createdAt: DatetimeString
}

/** Snapshot report transitions for their authors; appeals use the subject section. */
export async function notifyReportActivities(
  db: Database,
  activities: NotifiableReportActivity[],
): Promise<void> {
  const transitions = activities.filter(
    (activity) =>
      activity.activityType === 'closeActivity' ||
      activity.activityType === 'reopenActivity',
  )
  if (!transitions.length) return
  await runNotificationWork(db, async (txn) => {
    for (let offset = 0; offset < transitions.length; offset += 500) {
      const batch = transitions.slice(offset, offset + 500)
      // @NOTE Both sides are primary-key lookups, independent of table size.
      const reports = await txn.db
        .selectFrom('report as r')
        .innerJoin('moderation_event as e', 'e.id', 'r.eventId')
        .where(
          'r.id',
          'in',
          batch.map((activity) => activity.reportId),
        )
        .where('e.subjectType', 'in', [
          com.atproto.admin.defs.repoRef.$type,
          com.atproto.repo.strongRef.$type,
        ])
        .select([
          'r.id as reportId',
          'r.reportType',
          'e.createdBy',
          'e.subjectDid',
          'e.subjectUri',
          'e.subjectCid',
        ])
        .execute()
      const byId = new Map(reports.map((report) => [report.reportId, report]))
      const notifications: NotificationInput[] = []
      for (const activity of batch) {
        const report = byId.get(activity.reportId)
        if (!report) continue
        const isAppeal = report.reportType === APPEAL_REASON_TYPE
        if (isAppeal && activity.activityType !== 'closeActivity') continue
        const subject =
          report.subjectUri && report.subjectCid
            ? com.atproto.repo.strongRef.$build({
                uri: report.subjectUri,
                cid: report.subjectCid,
              })
            : com.atproto.admin.defs.repoRef.$build({ did: report.subjectDid })
        const reason = isAppeal
          ? 'appealResolved'
          : activity.activityType === 'closeActivity'
            ? 'reportResolved'
            : 'reportReopened'
        notifications.push({
          recipientDid: report.createdBy,
          reason,
          target: isAppeal
            ? { $type: 'tools.ozone.inbox.defs#subjectRef', subject }
            : {
                $type: 'tools.ozone.inbox.defs#reportRef',
                reportId: report.reportId,
                subject,
                status:
                  activity.activityType === 'closeActivity'
                    ? 'resolved'
                    : 'pending',
              },
          sourceKey: `report-activity:${activity.activityId}:${reason}`,
          createdAt: activity.createdAt,
        })
      }
      await createInboxNotifications(txn, notifications)
    }
  })
}
