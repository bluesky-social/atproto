import { ToolsOzoneModerationGetAccountTimeline } from '@atproto/api'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getAccountTimeline({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { did } = params
      const db = ctx.db
      const modService = ctx.modService(db)
      const timelineData = await modService.getAccountTimeline(did)
      const timelineByDay = new Map<
        string,
        ToolsOzoneModerationGetAccountTimeline.AccountTimelineSummary[]
      >()

      for (const row of timelineData) {
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
