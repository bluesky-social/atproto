import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getEvent({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const { data } =
        await ctx.moderationAgent.api.tools.ozone.moderation.getEvent(
          params,
          authPassthru(req),
        )
      return {
        encoding: 'application/json',
        body: data,
      }
    },
  })
}
