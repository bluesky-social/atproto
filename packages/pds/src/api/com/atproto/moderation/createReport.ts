import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReasonType, getSubject } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const requester = auth.credentials.did

      if (ctx.cfg.bskyAppView.proxyModeration) {
        const { data: result } =
          await ctx.appViewAgent.com.atproto.moderation.createReport(
            input.body,
            {
              ...(await ctx.serviceAuthHeaders(requester)),
              encoding: 'application/json',
            },
          )
        return {
          encoding: 'application/json',
          body: result,
        }
      }

      const { db, services } = ctx
      const { reasonType, reason, subject } = input.body

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
