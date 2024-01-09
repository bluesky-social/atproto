import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getReasonType } from './util'
import { subjectFromInput } from '../../mod-service/subject'
import { REASONAPPEAL } from '../../lexicon/types/com/atproto/moderation/defs'
import { ForbiddenError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    // @TODO anonymous reports w/ optional auth are a temporary measure
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ input, auth }) => {
      const requester =
        'did' in auth.credentials ? auth.credentials.did : ctx.cfg.service.did
      const { reasonType, reason } = input.body
      const subject = subjectFromInput(input.body.subject)

      // If the report is an appeal, the requester must be the author of the subject
      if (reasonType === REASONAPPEAL && requester !== subject.did) {
        throw new ForbiddenError('You cannot appeal this report')
      }

      const db = ctx.db
      const report = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.modService(dbTxn)
        return moderationTxn.report({
          reasonType: getReasonType(reasonType),
          reason,
          subject,
          reportedBy: requester || ctx.cfg.service.did,
        })
      })

      const body = ctx.modService(db).views.formatReport(report)
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
