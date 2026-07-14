import type { AppContext } from '../../context.js'
import type { Server } from '../../lexicon/index.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getReporterStats({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const db = ctx.db

      const stats = await ctx.modService(db).getReporterStats(params.dids)

      return {
        encoding: 'application/json',
        body: { stats },
      }
    },
  })
}
