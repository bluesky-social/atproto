import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  const { moderationAgent } = ctx
  if (!moderationAgent) return
  server.com.atproto.admin.getRepo({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const res = await moderationAgent.com.atproto.admin.getRepo(
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
