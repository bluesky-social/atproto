import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import {
  getActiveReportAssignments,
  getLatestReport,
} from '../../mod-service/report'
import { buildReportView, hydrateReportInfo } from '../../report/views'
import { getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getLatestReport({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ auth, req }) => {
      const db = ctx.db
      const modService = ctx.modService(db)
      const labelers = ctx.reqLabelers(req)

      const report = await getLatestReport(db)
      if (!report) {
        throw new InvalidRequestError('No report found', 'NotFound')
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
        encoding: 'application/json' as const,
        body: {
          report: buildReportView(
            report,
            hydrated,
            auth.credentials.isModerator,
          ),
        },
      }
    },
  })
}
