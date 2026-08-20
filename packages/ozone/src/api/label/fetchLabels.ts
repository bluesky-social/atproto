import type { DatetimeString } from '@atproto/lex'
import { toDatetimeString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { com } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.temp.fetchLabels, {
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ params }) => {
      const { limit } = params
      const since =
        params.since !== undefined
          ? toDatetimeString(new Date(params.since))
          : ('' as DatetimeString)
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
