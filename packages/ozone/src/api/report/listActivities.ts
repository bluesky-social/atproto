import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { formatActivityView, listReportActivities } from '../../report/activity'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.listActivities({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { reportId, limit, cursor } = params

      const { activities, cursor: nextCursor } = await listReportActivities(
        ctx.db,
        { reportId, limit, cursor },
      )

      return {
        encoding: 'application/json',
        body: {
          activities: activities.map(formatActivityView),
          cursor: nextCursor,
        },
      }
    },
  })
}
