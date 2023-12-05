import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.queryModerationEvents({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const { data: result } =
        await ctx.appViewAgent.com.atproto.admin.queryModerationEvents(
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
