import { AuthRequiredError, ForbiddenError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReasonType, getSubject } from './util'
import { softDeleted } from '../../../../db/util'
import { REASONAPPEAL } from '../../../../lexicon/types/com/atproto/moderation/defs'

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

      const reportReasonType = getReasonType(reasonType)
      const reportSubject = getSubject(subject)
      const subjectDid =
        'did' in reportSubject ? reportSubject.did : reportSubject.uri.host

      // If the report is an appeal, the requester must be the author of the subject
      if (reasonType === REASONAPPEAL && requester !== subjectDid) {
        throw new ForbiddenError('You cannot appeal this report')
      }

      const report = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        return moderationTxn.report({
          reasonType: reportReasonType,
          reason,
          subject: reportSubject,
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
