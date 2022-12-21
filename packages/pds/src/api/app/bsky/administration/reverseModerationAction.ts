import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.administration.reverseModerationAction({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { db, services } = ctx
      const adminService = services.admin(db)
      const { id, reversedBy, reversedRationale } = input.body

      const moderationAction = await db.transaction(async (dbTxn) => {
        const adminTxn = services.admin(dbTxn)
        const now = new Date()

        const existing = await adminTxn.getModAction(id)
        if (!existing) {
          throw new InvalidRequestError('Moderation action does not exist')
        }
        if (existing.reversedAt !== null) {
          throw new InvalidRequestError(
            'Moderation action has already been reversed',
          )
        }

        const result = await adminTxn.logReverseModAction({
          id,
          reversedAt: now,
          reversedBy,
          reversedRationale,
        })

        if (result.action === 'takedown' && result.subjectDid !== null) {
          await adminTxn.reverseTakedownActorByDid({ did: result.subjectDid })
        }

        return result
      })

      return {
        encoding: 'application/json',
        body: adminService.formatModActionView(moderationAction),
      }
    },
  })
}
