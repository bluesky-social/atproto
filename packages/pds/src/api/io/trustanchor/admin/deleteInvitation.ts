import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { validateAdminAuth } from './shared'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.admin.deleteInvitation({
    handler: async ({ req, input }) => {
      // Validate admin authentication
      validateAdminAuth(req, ctx)

      const { email, id } = input.body as { email?: string; id?: number }

      if (!email && !id) {
        throw new Error('Either email or id must be provided')
      }

      const idOrEmail = id || email!

      try {
        // First try to revoke (if pending)
        await ctx.invitationManager.revokeInvitation(idOrEmail)

        return {
          encoding: 'application/json',
          body: {
            revoked: true,
            [typeof idOrEmail === 'number' ? 'id' : 'email']: idOrEmail,
          },
        }
      } catch (err) {
        // If not pending, hard delete
        if (typeof idOrEmail === 'number') {
          await ctx.invitationManager.deleteInvitation(idOrEmail)
        } else {
          // For email, find by email first
          const inv = await ctx.invitationManager.db.db
            .selectFrom('pending_invitations')
            .select('id')
            .where('email', '=', idOrEmail.toLowerCase())
            .executeTakeFirst()

          if (inv) {
            await ctx.invitationManager.deleteInvitation(inv.id)
          } else {
            throw new Error('Invitation not found')
          }
        }

        return {
          encoding: 'application/json',
          body: {
            deleted: true,
            [typeof idOrEmail === 'number' ? 'id' : 'email']: idOrEmail,
          },
        }
      }
    },
  })
}
