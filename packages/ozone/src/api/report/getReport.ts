import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import {
  getActiveReportAssignments,
  getReportById,
} from '../../mod-service/report'
import { buildReportView, hydrateReportInfo } from '../../report/views'
import { getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getReport({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const modService = ctx.modService(db)
      const labelers = ctx.reqLabelers(req)

      const report = await getReportById(db, params.id)
      if (!report) {
        throw new InvalidRequestError(`Report not found: ${params.id}`)
      }

      const queueService = ctx.queueService(db)
      const hydrated = await hydrateReportInfo(
        [report],
        modService.views,
        (dids) => getPdsAccountInfos(ctx, dids),
        (reportIds) => getActiveReportAssignments(db, reportIds),
        (queueIds) => queueService.getViewsByIds(queueIds),
        labelers,
      )

      return {
        encoding: 'application/json',
        body: buildReportView(report, hydrated, auth.credentials.isModerator),
      }
    },
  })
}
