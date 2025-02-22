import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.fetchLabels({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ params }) => {
      const { limit } = params
      const since =
        params.since !== undefined ? new Date(params.since).toISOString() : ''
      const labelRes = await ctx.db.db
        .selectFrom('label')
        .selectAll()
        .orderBy('label.cts', 'asc')
        .where('cts', '>', since)
        .limit(limit)
        .execute()

      const modSrvc = ctx.modService(ctx.db)
      const labels = await Promise.all(
        labelRes.map((l) => modSrvc.views.formatLabelAndEnsureSig(l)),
      )

      return {
        encoding: 'application/json',
        body: {
          labels,
        },
      }
    },
  })
}
