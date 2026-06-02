import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'
import {
  formatActivityView,
  queryReportActivities,
} from '../../report/activity.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.queryActivities({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { activities, cursor: nextCursor } = await queryReportActivities(
        ctx.db,
        params,
      )

      const createdByDids = Array.from(
        new Set(activities.map((a) => a.createdBy)),
      )
      const teamService = ctx.teamService(ctx.db)
      const memberViews = await teamService.viewByDids(createdByDids)

      return {
        encoding: 'application/json',
        body: {
          activities: activities.map((activity) =>
            formatActivityView(activity, memberViews),
          ),
          cursor: nextCursor,
        },
      }
    },
  })
}
