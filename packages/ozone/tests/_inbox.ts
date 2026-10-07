import type { ModeratorClient } from '@atproto/dev-env'

type ReportView = Awaited<
  ReturnType<ModeratorClient['queryReports']>
>['reports'][number]

/** Resolve the public report ID using the same API available to moderators. */
export async function reportForEvent(
  mod: ModeratorClient,
  eventId: number,
): Promise<
  Omit<ReportView, 'actionEventIds'> & {
    queueId: number
    actionEventIds: number[] | null
  }
> {
  for (const status of ['open', 'queued', 'closed', 'assigned', 'escalated']) {
    for (const isMuted of [false, true]) {
      const { reports } = await mod.queryReports({
        status,
        isMuted,
        limit: 100,
      })
      const report = reports.find((row) => row.eventId === eventId)
      if (report)
        return {
          ...report,
          queueId: report.queue?.id ?? -1,
          actionEventIds: report.actionEventIds ?? null,
        }
    }
  }
  throw new Error(`No report returned for event ${eventId}`)
}
