import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, mergeRepoViewPdsDetails } from './util'
import { isRepoView } from '../../../../lexicon/types/com/atproto/admin/defs'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReport({
    auth: ctx.roleVerifier,
    handler: async ({ req, params, auth }) => {
      const access = auth.credentials
      const { db, services } = ctx
      const accountService = services.account(db)
      const moderationService = services.moderation(db)

      if (ctx.cfg.bskyAppView.proxyModeration) {
        const { data: resultAppview } =
          await ctx.appViewAgent.com.atproto.admin.getModerationReport(
            params,
            authPassthru(req),
          )
        // merge local repo state for subject if available
        if (isRepoView(resultAppview.subject)) {
          const account = await accountService.getAccount(
            resultAppview.subject.did,
            true,
          )
          const repo =
            account &&
            (await moderationService.views.repo(account, {
              includeEmails: access.moderator,
            }))
          if (repo) {
            resultAppview.subject = mergeRepoViewPdsDetails(
              resultAppview.subject,
              repo,
            )
          }
        }
        return {
          encoding: 'application/json',
          body: resultAppview,
        }
      }

      const { id } = params
      const result = await moderationService.getReportOrThrow(id)
      return {
        encoding: 'application/json',
        body: await moderationService.views.reportDetail(result, {
          includeEmails: access.moderator,
        }),
      }
    },
  })
}
