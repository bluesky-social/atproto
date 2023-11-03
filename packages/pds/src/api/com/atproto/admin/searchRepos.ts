import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.searchRepos({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      // @TODO merge invite details to this list view. could also add
      // support for invitedBy param, which is not supported by appview.
      const { data: result } =
        await ctx.appViewAgent.com.atproto.admin.searchRepos(
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
