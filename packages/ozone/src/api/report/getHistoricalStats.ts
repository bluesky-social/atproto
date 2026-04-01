import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ReportStatTimeframe } from '../../report/stats'
import { viewHistoricalStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getHistoricalStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { timeframe, queueId, moderatorDid, reportTypes } = params

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const row = await reportStatsService.getLatestStats({
        mode: 'historical',
        timeframe: timeframe as ReportStatTimeframe,
        queueId: queueId ?? null,
        moderatorDid: moderatorDid ?? null,
        reportTypes: reportTypes?.length ? reportTypes : null,
      })

      return {
        encoding: 'application/json' as const,
        body: {
          stats: viewHistoricalStats(row),
        },
      }
    },
  })
}
