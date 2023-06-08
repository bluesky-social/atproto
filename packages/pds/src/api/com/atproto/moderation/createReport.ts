import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReasonType, getSubject } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { db, services } = ctx
      const { reasonType, reason, subject } = input.body
      const requester = auth.credentials.did

      const moderationService = services.moderation(db)

      const report = await moderationService.report({
        reasonType: getReasonType(reasonType),
        reason,
        subject: getSubject(subject),
        reportedBy: requester,
      })

      return {
        encoding: 'application/json',
        body: moderationService.views.reportPublic(report),
      }
    },
  })
}
