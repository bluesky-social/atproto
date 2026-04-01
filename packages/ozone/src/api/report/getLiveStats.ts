import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { viewLiveStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getLiveStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { queueId, moderatorDid, reportTypes } = params

      const reportStatsService = ctx.reportStatsService(ctx.db)
      let row
      if (moderatorDid) {
        row = await reportStatsService.getLiveModeratorStats(moderatorDid)
      } else if (reportTypes && reportTypes.length > 0) {
        row = await reportStatsService.getLiveReportTypeStats(reportTypes)
      } else if (queueId !== undefined) {
        row = await reportStatsService.getLiveQueueStats(queueId)
      } else {
        row = await reportStatsService.getLiveAggregateStats()
      }

      return {
        encoding: 'application/json' as const,
        body: {
          stats: viewLiveStats(row),
        },
      }
    },
  })
}
