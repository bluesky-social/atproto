import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.getReporterStats, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, signal }) => {
      const db = ctx.db

      const stats = await ctx
        .modService(db)
        .getReporterStats(params.dids, signal)

      return {
        encoding: 'application/json',
        body: { stats },
      }
    },
  })
}
