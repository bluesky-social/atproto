import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { viewLiveStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getLiveStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { queueId, moderatorDid, reportTypes } = params

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const row = await reportStatsService.getLiveStats({
        timeframe: 'day',
        queueId: queueId ?? null,
        moderatorDid: moderatorDid ?? null,
        reportTypes: reportTypes?.length ? reportTypes : null,
      })

      return {
        encoding: 'application/json' as const,
        body: {
          stats: viewLiveStats(row),
        },
      }
    },
  })
}
