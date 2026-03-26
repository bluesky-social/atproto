import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { viewModeratorStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getLiveModeratorStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { moderatorDid } = params

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const row = await reportStatsService.getLiveModeratorStats(moderatorDid)

      return {
        encoding: 'application/json' as const,
        body: {
          stats: viewModeratorStats(row),
        },
      }
    },
  })
}
