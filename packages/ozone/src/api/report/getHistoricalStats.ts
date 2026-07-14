import { ForbiddenError } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import type { Server } from '../../lexicon/index.js'
import { viewHistoricalStats } from '../../report/views.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getHistoricalStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      const {
        queueId,
        moderatorDid,
        reportTypes,
        startDate,
        endDate,
        limit,
        cursor,
      } = params

      if (moderatorDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Unauthorized')
      }

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const result = await reportStatsService.getHistoricalStats({
        group: {
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
        encoding: 'application/json',
        body: {
          stats: result.stats.map(viewHistoricalStats),
          cursor: result.cursor,
        },
      }
    },
  })
}
