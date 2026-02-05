import { Server } from '../../../../lexicon'
import { AppContext } from '../../../../context'
import { validateAdminAuth } from './shared'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.admin.purgeInvitations({
    handler: async ({ req, input }) => {
      // Validate admin authentication
      validateAdminAuth(req, ctx)

      const { status, before } = input.body as {
        status: 'consumed' | 'expired' | 'revoked'
        before?: string
      }

      if (!status) {
        throw new Error('Status is required')
      }

      if (!['consumed', 'expired', 'revoked'].includes(status)) {
        throw new Error('Invalid status. Must be: consumed, expired, or revoked')
      }

      // Purge invitations
      const deletedCount = await ctx.invitationManager.purgeInvitations(
        status,
        before,
      )

      return {
        encoding: 'application/json',
        body: {
          deletedCount,
          status,
          before,
        },
      }
    },
  })
}
