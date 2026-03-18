import { ToolsOzoneQueueDefs } from '@atproto/api'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.getLiveStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { queueId } = params

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const row = await reportStatsService.getLiveStats(queueId)

      const now = new Date().toISOString()
      const stats: ToolsOzoneQueueDefs.QueueStats = {
        pendingCount: row?.pendingCount ?? 0,
        actionedCount: row?.actionedCount ?? 0,
        escalatedPendingCount: row?.escalatedCount ?? 0,
        uniqueReportersCount: 0,
        uniqueSubjectsDidCount: 0,
        uniqueSubjectsFullCount: 0,
        inboundCount: row?.inboundCount ?? 0,
        actionRate: row?.actionRate ?? 0,
        lastUpdated: row?.computedAt ?? now,
      }

      return {
        encoding: 'application/json' as const,
        body: { stats },
      }
    },
  })
}
