import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { viewQueueStats } from '../../report/views'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.getLiveStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { queueId, moderatorDid } = params

      if (queueId !== undefined && moderatorDid !== undefined) {
        throw new InvalidRequestError(
          'Cannot filter by both queue and moderator',
        )
      }

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const row = await reportStatsService.getLiveStats(queueId, moderatorDid)

      return {
        encoding: 'application/json' as const,
        body: {
          stats: viewQueueStats(row),
        },
      }
    },
  })
}
