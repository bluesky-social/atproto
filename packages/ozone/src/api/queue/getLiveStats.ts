import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { viewQueueStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.getLiveStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { queueId } = params

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const row = await reportStatsService.getLiveQueueStats(queueId)

      return {
        encoding: 'application/json' as const,
        body: {
          stats: viewQueueStats(row),
        },
      }
    },
  })
}
