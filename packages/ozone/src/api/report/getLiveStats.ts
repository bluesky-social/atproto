import { ForbiddenError } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import type { Server } from '../../lexicon/index.js'
import { viewLiveStats } from '../../report/views.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.getLiveStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      const { queueId, moderatorDid, reportTypes } = params

      if (moderatorDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Unauthorized')
      }

      const reportStatsService = ctx.reportStatsService(ctx.db)
      const row = await reportStatsService.getLiveStats({
        queueId: queueId ?? null,
        moderatorDid: moderatorDid ?? null,
        reportTypes: reportTypes?.length ? reportTypes : null,
      })

      return {
        encoding: 'application/json',
        body: {
          stats: viewLiveStats(row),
        },
      }
    },
  })
}
