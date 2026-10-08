import type { DatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import {
  APPEAL_REASON_TYPE,
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
} from '../inbox/appeal.js'
import { runNotificationWork } from '../inbox/notification-work.js'
import {
  type NotificationInput,
  createInboxNotifications,
} from '../inbox/notifications.js'
import { inboxHasStarted } from '../inbox/start.js'
import { com, tools } from '../lexicons/index.js'

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
  startAt?: DatetimeString,
): Promise<void> {
  if (!inboxHasStarted(startAt)) return
  const transitions = activities.filter(
    (activity) =>
      (!startAt || activity.createdAt >= startAt) &&
      (activity.activityType === 'closeActivity' ||
        activity.activityType === 'reopenActivity'),
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
          'e.action',
          '=',
          tools.ozone.moderation.defs.modEventReport.$type,
        )
        .$if(startAt !== undefined, (qb) =>
          qb.where('r.createdAt', '>=', startAt!).where((eb) =>
            eb.or([
              eb('r.reportType', '!=', APPEAL_REASON_TYPE),
              eb.exists(
                eb
                  .selectFrom('moderation_event as action')
                  .whereRef('action.subjectDid', '=', 'e.subjectDid')
                  .where('action.subjectType', 'in', [
                    com.atproto.admin.defs.repoRef.$type,
                    com.atproto.repo.strongRef.$type,
                  ])
                  .where('action.action', 'in', [...PUBLIC_EVENT_ACTIONS])
                  .where('action.action', '!=', REVERSE_TAKEDOWN)
                  .where('action.createdAt', '>=', startAt!)
                  .where((inner) =>
                    inner.or([
                      inner(
                        'action.subjectUri',
                        '=',
                        inner.ref('e.subjectUri'),
                      ),
                      inner.and([
                        inner('action.subjectUri', 'is', null),
                        inner('e.subjectUri', 'is', null),
                      ]),
                    ]),
                  )
                  .select('action.id'),
              ),
            ]),
          ),
        )
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
      await createInboxNotifications(txn, notifications, startAt)
    }
  })
}
