import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { validateAdminAuth } from './shared'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.admin.listInvitations({
    handler: async ({ req, params }) => {
      // Validate admin authentication
      validateAdminAuth(req, ctx)

      const {
        status = 'pending',
        before,
        limit = 50,
        cursor,
      } = params as {
        status?: 'pending' | 'consumed' | 'expired' | 'revoked' | 'all'
        before?: string
        limit?: number
        cursor?: string
      }

      // Parse cursor as offset
      const offset = cursor ? parseInt(cursor, 10) : 0

      // Get invitations
      const invitations = await ctx.invitationManager.getInvitations({
        status,
        beforeTimestamp: before,
        limit: limit + 1, // Fetch one extra to check for next page
        offset,
      })

      // Check if there are more results
      const hasMore = invitations.length > limit
      const results = hasMore ? invitations.slice(0, limit) : invitations
      const nextCursor = hasMore ? String(offset + limit) : undefined

      return {
        encoding: 'application/json',
        body: {
          invitations: results.map((inv) => ({
            id: inv.id,
            email: inv.email,
            preferredHandle: inv.preferred_handle ?? undefined,
            status: inv.status as
              | 'pending'
              | 'consumed'
              | 'expired'
              | 'revoked',
            invitationTimestamp: inv.invitation_timestamp,
            createdAt: inv.created_at,
            expiresAt: inv.expires_at,
            consumedAt: inv.consumed_at ?? undefined,
            consumingDid: inv.consuming_did ?? undefined,
            consumingHandle: inv.consuming_handle ?? undefined,
          })),
          cursor: nextCursor,
        },
      }
    },
  })
}
