import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const { data: result } =
        await ctx.moderationAgent.com.atproto.admin.searchRepos(
          params,
          authPassthru(req),
        )
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
