import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import {
  getActiveReportAssignments,
  queryReports,
} from '../../mod-service/report'
import { buildReportView, hydrateReportInfo } from '../../report/views'
import { getPdsAccountInfos } from '../util'

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
        (reportIds) => getActiveReportAssignments(db, reportIds),
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
