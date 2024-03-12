import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getRepo({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const res = await ctx.moderationAgent.api.tools.ozone.moderation.getRepo(
        params,
        authPassthru(req),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
