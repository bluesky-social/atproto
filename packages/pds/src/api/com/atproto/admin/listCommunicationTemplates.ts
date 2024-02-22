import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  const { moderationAgent } = ctx
  if (!moderationAgent) return
  server.com.atproto.admin.listCommunicationTemplates({
    auth: ctx.authVerifier.role,
    handler: async ({ req }) => {
      const { data: result } =
        await moderationAgent.com.atproto.admin.listCommunicationTemplates(
          {},
          authPassthru(req, true),
        )
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
