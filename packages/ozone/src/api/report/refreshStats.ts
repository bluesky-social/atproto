import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.refreshStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      if (!access.isModerator) {
        throw new Error('Must be a moderator to refresh stats')
      }

      const { startDate, endDate, queueIds } = input.body
      const reportStatsService = ctx.reportStatsService(ctx.db)
      await reportStatsService.refreshDateRange({
        startDate,
        endDate,
        queueIds,
      })

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
