import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'
import { debugCatch } from '../../../../util/debug'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.emitModerationEvent({
    auth: ctx.authVerifier.role,
    handler: debugCatch(async ({ req, input }) => {
      const { data: result } =
        await ctx.moderationAgent.com.atproto.admin.emitModerationEvent(
          input.body,
          authPassthru(req, true),
        )
      return {
        encoding: 'application/json',
        body: result,
      }
    }),
  })
}
