import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const res = await ctx.appviewAgent.api.com.atproto.admin.searchRepos(
        params,
        await ctx.appviewAuth(),
      )
      const db = ctx.db
      const modService = ctx.modService(db)
      const views = await modService.views.repos(
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
