import { toDatetimeString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { com } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.temp.fetchLabels, {
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ params }) => {
      const { limit } = params
      let builder = ctx.db.db
        .selectFrom('label')
        .selectAll()
        .orderBy('label.cts', 'asc')
        .limit(limit)

      if (params.since !== undefined) {
        builder = builder.where(
          'cts',
          '>',
          toDatetimeString(new Date(params.since)),
        )
      }

      const labelRes = await builder.execute()

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
