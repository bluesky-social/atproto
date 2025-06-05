import { ToolsOzoneModerationGetAccountTimeline } from '@atproto/api'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ids } from '../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getAccountTimeline({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { did } = params
      const db = ctx.db
      const modService = ctx.modService(db)
      const [movEventHistory, accountHistory, plcHistory] =
        await Promise.allSettled([
          modService.getAccountTimeline(did),
          getAccountHistory(ctx, did),
          getPlcHistory(ctx, did),
        ])
      const timelineByDay = new Map<
        string,
        ToolsOzoneModerationGetAccountTimeline.AccountTimelineSummary[]
      >()

      if (movEventHistory.status === 'fulfilled') {
        for (const row of movEventHistory.value) {
          const day = timelineByDay.get(row.day)
          const summary = {
            eventSubjectType: row.subjectUri ? 'record' : 'account',
            eventType: row.action,
            count: row.count,
          }
          if (day) {
            day.push(summary)
            timelineByDay.set(row.day, day)
          } else {
            timelineByDay.set(row.day, [summary])
          }
        }
      }

      if (accountHistory.status === 'fulfilled') {
        for (const [rowDay, row] of Object.entries(accountHistory.value)) {
          const day = timelineByDay.get(rowDay)
          const summaries: ToolsOzoneModerationGetAccountTimeline.AccountTimelineSummary[] =
            []
          for (const [eventType, count] of Object.entries(row)) {
            summaries.push({
              eventSubjectType: 'account',
              eventType,
              count,
            })
          }
          if (day) {
            day.push(...summaries)
            timelineByDay.set(rowDay, day)
          } else {
            timelineByDay.set(rowDay, summaries)
          }
        }
      }

      if (plcHistory.status === 'fulfilled') {
        for (const [rowDay, row] of Object.entries(plcHistory.value)) {
          const day = timelineByDay.get(rowDay)
          const summaries: ToolsOzoneModerationGetAccountTimeline.AccountTimelineSummary[] =
            []
          for (const [eventType, count] of Object.entries(row)) {
            summaries.push({
              eventSubjectType: 'account',
              eventType,
              count,
            })
          }
          if (day) {
            day.push(...summaries)
            timelineByDay.set(rowDay, day)
          } else {
            timelineByDay.set(rowDay, summaries)
          }
        }
      }

      const timeline: ToolsOzoneModerationGetAccountTimeline.AccountTimeline[] =
        []

      for (const [day, summary] of timelineByDay.entries()) {
        timeline.push({ day, summary: summary.flat() })
      }

      return {
        encoding: 'application/json',
        body: { timeline },
      }
    },
  })
}

const getAccountHistory = async (ctx: AppContext, did: string) => {
  const events: Record<string, Record<string, number>> = {}

  if (!ctx.pdsAgent) {
    return events
  }

  const auth = await ctx.pdsAuth(ids.ToolsOzoneHostingGetAccountHistory)
  let cursor: string | undefined = undefined

  do {
    const { data } = await ctx.pdsAgent.tools.ozone.hosting.getAccountHistory(
      { did },
      auth,
    )
    cursor = data.cursor
    for (const event of data.events) {
      // This should never happen and the check is here only because typescript screams at us otherwise
      if (!event.$type) {
        continue
      }

      const day = new Date(event.createdAt).toISOString().split('T')[0]
      if (!events[day]) {
        events[day] = {}
      }

      events[day][event.$type] = (events[day][event.$type] || 0) + 1
    }
  } while (cursor)

  return events
}

const getPlcHistory = async (ctx: AppContext, did: string) => {
  const events: Record<string, Record<string, number>> = {}

  if (!ctx.plcClient) {
    return events
  }

  const result = await ctx.plcClient.getAuditableLog(did)
  for (const event of result) {
    const day = new Date(event.createdAt).toISOString().split('T')[0]
    if (!events[day]) {
      events[day] = {}
    }

    events[day][event.operation.type] =
      (events[day][event.operation.type] || 0) + 1
  }

  return events
}
