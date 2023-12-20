import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const res = await ctx.appviewAgent.api.com.atproto.admin.searchRepos(
        params,
      )
      const db = ctx.db
      const moderationService = ctx.services.moderation(db)
      const views = await moderationService.views.repos(
        res.data.repos.map((r) => r.did),
      )
      const repos = res.data.repos.map((r) => ({
        ...r,
        moderation: views.get(r.did)?.moderation ?? {},
      }))
      return {
        encoding: 'application/json',
        body: {
          cursor: res.data.cursor,
          repos,
        },
      }
    },
  })
}
