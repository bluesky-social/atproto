import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReasonType, getSubject } from './util'
import { softDeleted } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    // @TODO anonymous reports w/ optional auth are a temporary measure
    auth: ctx.authOptionalVerifier,
    handler: async ({ input, auth }) => {
      const { reasonType, reason, subject } = input.body
      const requester = auth.credentials.did

      const db = ctx.db.getPrimary()

      if (requester) {
        // Don't accept reports from users that are fully taken-down
        const actor = await ctx.services.actor(db).getActor(requester, true)
        if (actor && softDeleted(actor)) {
          throw new AuthRequiredError()
        }
      }

      const report = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        return moderationTxn.report({
          reasonType: getReasonType(reasonType),
          reason,
          subject: getSubject(subject),
          reportedBy: requester || ctx.cfg.serverDid,
        })
      })

      const moderationService = ctx.services.moderation(db)
      return {
        encoding: 'application/json',
        body: moderationService.views.reportPublic(report),
      }
    },
  })
}
