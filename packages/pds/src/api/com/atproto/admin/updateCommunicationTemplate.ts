import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateCommunicationTemplate({
    auth: ctx.authVerifier.role,
    handler: async ({ req, input }) => {
      const { data: result } =
        await ctx.moderationAgent.com.atproto.admin.updateCommunicationTemplate(
          input.body,
          authPassthru(req, true),
        )

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
