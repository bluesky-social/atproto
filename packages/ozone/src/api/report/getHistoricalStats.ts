import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { viewHistoricalStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getHistoricalStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const {
        queueId,
        moderatorDid,
        reportTypes,
        startDate,
        endDate,
        limit,
        cursor,
      } = params

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const result = await reportStatsService.getHistoricalStats({
        group: {
          timeframe: 'day',
          queueId: queueId ?? null,
          moderatorDid: moderatorDid ?? null,
          reportTypes: reportTypes?.length ? reportTypes : null,
        },
        startDate,
        endDate,
        limit: limit ?? 30,
        cursor,
      })

      return {
        encoding: 'application/json' as const,
        body: {
          stats: result.stats.map(viewHistoricalStats),
          cursor: result.cursor,
        },
      }
    },
  })
}
