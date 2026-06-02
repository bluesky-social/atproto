import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'
import { ReportView } from '../../lexicon/types/tools/ozone/report/defs.js'
import { getReportsByIds } from '../../mod-service/report.js'
import {
  formatActivityView,
  queryReportActivities,
} from '../../report/activity.js'
import { buildReportView, hydrateReportInfo } from '../../report/views.js'
import { getPdsAccountInfos } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.queryActivities({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const modService = ctx.modService(db)
      const labelers = ctx.reqLabelers(req)

      const { activities, cursor: nextCursor } = await queryReportActivities(
        db,
        params,
      )

      // Dedupe report IDs across the page. Many activities can share the
      // same report so we want one bulk fetch + hydrate rather than N.
      const reportIds = Array.from(new Set(activities.map((a) => a.reportId)))

      const queueService = ctx.queueService(db)
      const teamService = ctx.teamService(db)
      const reports = await getReportsByIds(db, reportIds)
      const hydrated = await hydrateReportInfo(
        reports,
        modService.views,
        (dids) => getPdsAccountInfos(ctx, dids),
        (queueIds) => queueService.getViewsByIds(queueIds),
        (dids) => teamService.viewByDids(dids),
        labelers,
      )
      const reportViews = new Map<number, ReportView>()
      for (const report of reports) {
        reportViews.set(
          report.id,
          buildReportView(report, hydrated, auth.credentials.isModerator),
        )
      }

      const createdByDids = Array.from(
        new Set(activities.map((a) => a.createdBy)),
      )
      const memberViews = await teamService.viewByDids(createdByDids)

      return {
        encoding: 'application/json',
        body: {
          activities: activities.map((activity) =>
            formatActivityView(activity, memberViews, reportViews),
          ),
          cursor: nextCursor,
        },
      }
    },
  })
}
