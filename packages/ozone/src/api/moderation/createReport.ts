import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getReasonType } from './util'
import { subjectFromInput } from '../../mod-service/subject'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    // @TODO anonymous reports w/ optional auth are a temporary measure
    auth: ctx.authOptionalVerifier,
    handler: async ({ input, auth }) => {
      const requester = auth.credentials.did
      const { reasonType, reason } = input.body
      const subject = subjectFromInput(input.body.subject)
      const db = ctx.db

      const report = await db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.modService(dbTxn)
        return moderationTxn.report({
          reasonType: getReasonType(reasonType),
          reason,
          subject,
          reportedBy: requester || ctx.cfg.serverDid,
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
