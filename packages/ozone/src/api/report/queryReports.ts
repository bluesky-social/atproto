import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'
import { queryReports } from '../../mod-service/report.js'
import { buildReportView, hydrateReportInfo } from '../../report/views.js'
import { getPdsAccountInfos } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.queryReports({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const modService = ctx.modService(db)
      const labelers = ctx.reqLabelers(req)

      const { reports: reportsToReturn, cursor } = await queryReports(
        db,
        params,
      )

      const queueService = ctx.queueService(db)
      const teamService = ctx.teamService(db)
      const hydrated = await hydrateReportInfo(
        reportsToReturn,
        modService.views,
        (dids) => getPdsAccountInfos(ctx, dids),
        (queueIds) => queueService.getViewsByIds(queueIds),
        (dids) => teamService.viewByDids(dids),
        labelers,
      )

      const reportViews = reportsToReturn.map((report) =>
        buildReportView(report, hydrated, auth.credentials.isModerator),
      )

      return {
        encoding: 'application/json',
        body: {
          cursor,
          reports: reportViews,
        },
      }
    },
  })
}
