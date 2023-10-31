import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReport({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const { data: resultAppview } =
        await ctx.appViewAgent.com.atproto.admin.getModerationReport(
          params,
          authPassthru(req),
        )
      return {
        encoding: 'application/json',
        body: resultAppview,
      }
    },
  })
}
