import { ToolsOzoneModerationGetAccountTimeline } from '@atproto/api'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ids } from '../../lexicon/lexicons'
import { dateFromDatetime } from '../../mod-service/util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getAccountTimeline({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { did } = params
      const db = ctx.db
      const modService = ctx.modService(db)
      const [modEventHistory, accountHistory, plcHistory] =
        await Promise.allSettled([
          modService.getAccountTimeline(did),
          getAccountHistory(ctx, did),
          getPlcHistory(ctx, did),
        ])
      const timelineByDay = new Map<
        string,
        ToolsOzoneModerationGetAccountTimeline.TimelineItemSummary[]
      >()

      if (modEventHistory.status === 'fulfilled') {
        for (const row of modEventHistory.value) {
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
      } else {
        throw modEventHistory.reason
      }

      if (accountHistory.status === 'fulfilled') {
        for (const [rowDay, row] of Object.entries(accountHistory.value)) {
          const day = timelineByDay.get(rowDay)
          const summaries: ToolsOzoneModerationGetAccountTimeline.TimelineItemSummary[] =
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
          const summaries: ToolsOzoneModerationGetAccountTimeline.TimelineItemSummary[] =
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

      const timeline: ToolsOzoneModerationGetAccountTimeline.TimelineItem[] = []

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
      { did, cursor },
      auth,
    )
    cursor = data.cursor
    for (const event of data.events) {
      // This should never happen and the check is here only because typescript screams at us otherwise
      if (!event.$type) {
        continue
      }

      const day = dateFromDatetime(new Date(event.createdAt))
      events[day] ??= {}
      events[day][event.$type] ??= 0
      events[day][event.$type]++
    }
  } while (cursor)

  return events
}

const PLC_OPERATION_MAP = {
  create: 'tools.ozone.moderation.defs#timelineEventPlcCreate',
  plc_operation: 'tools.ozone.moderation.defs#timelineEventPlcOperation',
  plc_tombstone: 'tools.ozone.moderation.defs#timelineEventPlcTombstone',
}

const getPlcHistory = async (ctx: AppContext, did: string) => {
  const events: Record<string, Record<string, number>> = {}

  if (!ctx.plcClient) {
    return events
  }

  const result = await ctx.plcClient.getAuditableLog(did)
  for (const event of result) {
    // Skip events that are not mapped, this means we will have to add correct mapping if/when new event types are introduced here
    if (!Object.hasOwn(PLC_OPERATION_MAP, event.operation.type)) {
      continue
    }
    const day = dateFromDatetime(new Date(event.createdAt))
    events[day] ??= {}
    const eventType =
      PLC_OPERATION_MAP[event.operation.type] || event.operation.type
    events[day][eventType] ??= 0
    events[day][eventType]++
  }

  return events
}
