import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  const { moderationAgent } = ctx
  if (!moderationAgent) return
  server.com.atproto.admin.createCommunicationTemplate({
    auth: ctx.authVerifier.role,
    handler: async ({ req, input }) => {
      const { data: result } =
        await moderationAgent.com.atproto.admin.createCommunicationTemplate(
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
