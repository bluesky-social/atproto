import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ReportStatTimeframe } from '../../report/stats'
import { viewHistoricalStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getHistoricalStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { timeframe, queueId, moderatorDid, reportTypes } = params

      const tf = timeframe as ReportStatTimeframe
      const reportStatsService = ctx.reportStatsService(ctx.db)
      let row
      if (moderatorDid) {
        row = await reportStatsService.getHistoricalModeratorStats(
          tf,
          moderatorDid,
        )
      } else if (reportTypes && reportTypes.length > 0) {
        row = await reportStatsService.getHistoricalReportTypeStats(
          tf,
          reportTypes,
        )
      } else if (queueId !== undefined) {
        row = await reportStatsService.getHistoricalQueueStats(tf, queueId)
      } else {
        row = await reportStatsService.getHistoricalAggregateStats(tf)
      }

      return {
        encoding: 'application/json' as const,
        body: {
          stats: viewHistoricalStats(row),
        },
      }
    },
  })
}
