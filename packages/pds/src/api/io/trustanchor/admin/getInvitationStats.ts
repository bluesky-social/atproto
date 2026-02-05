import { Server } from '../../../../lexicon'
import { AppContext } from '../../../../context'
import { validateAdminAuth } from './shared'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.admin.getInvitationStats({
    handler: async ({ req, params }) => {
      // Validate admin authentication
      validateAdminAuth(req, ctx)

      const { since } = params as { since?: string }

      // Get statistics
      const stats = await ctx.invitationManager.getStats(since)

      return {
        encoding: 'application/json',
        body: {
          pending: stats.pending,
          consumed: stats.consumed,
          expired: stats.expired,
          revoked: stats.revoked,
          consumedSince: stats.consumedSince,
          conversionRate: stats.conversionRate,
        },
      }
    },
  })
}
