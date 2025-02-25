import { MINUTE } from '@atproto/common'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.resetPassword({
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 50,
      },
    ],
    handler: async ({ input, req }) => {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.resetPassword(
          input.body,
          ctx.entrywayPassthruHeaders(req),
        )
        return
      }

      const { token, password } = input.body

      await ctx.accountManager.resetPassword({ token, password })
    },
  })
}
