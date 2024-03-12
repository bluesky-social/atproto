import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.communication.deleteTemplate({
    auth: ctx.authVerifier.role,
    handler: async ({ req, input }) => {
      await ctx.moderationAgent.api.tools.ozone.communication.deleteTemplate(
        input.body,
        authPassthru(req, true),
      )
    },
  })
}
