import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import { authPassthru } from '../../proxy'

export default function (server: Server, ctx: AppContext) {
  const { moderationAgent } = ctx
  if (!moderationAgent) return
  server.tools.ozone.queryModerationStatuses({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const { data } =
        await moderationAgent.api.tools.ozone.queryModerationStatuses(
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
