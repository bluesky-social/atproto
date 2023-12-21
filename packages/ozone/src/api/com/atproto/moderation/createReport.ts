import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReasonType } from './util'
import { softDeleted } from '../../../../db/util'
import { subjectFromInput } from '../../../../services/moderation/subject'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    // @TODO anonymous reports w/ optional auth are a temporary measure
    auth: ctx.authOptionalVerifier,
    handler: async ({ input, auth }) => {
      const requester = auth.credentials.did
      const { reasonType, reason } = input.body
      const subject = subjectFromInput(input.body.subject)

      const db = ctx.db

      // @TODO
      // if (requester) {
      //   // Don't accept reports from users that are fully taken-down
      //   const actor = await ctx.services.actor(db).getActor(requester, true)
      //   if (actor && softDeleted(actor)) {
      //     throw new AuthRequiredError()
      //   }
      // }

      const report = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        return moderationTxn.report({
          reasonType: getReasonType(reasonType),
          reason,
          subject,
          reportedBy: requester || ctx.cfg.serverDid,
        })
      })

      const moderationService = ctx.services.moderation(db)
      return {
        encoding: 'application/json',
        body: moderationService.views.formatReport(report),
      }
    },
  })
}
