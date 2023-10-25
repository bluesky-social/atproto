import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { MINUTE } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.resetPassword({
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 50,
      },
    ],
    handler: async ({ input }) => {
      const { token, password } = input.body

      await ctx.accountManager.resetPassword({ token, password })
    },
  })
}
