import { Server } from '../../lexicon'
import AppContext from '../../context'
import { formatLabel } from '../../mod-service/util'
import {
  UNSPECCED_TAKEDOWN_BLOBS_LABEL,
  UNSPECCED_TAKEDOWN_LABEL,
} from '../../mod-service/types'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.fetchLabels({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ auth, params }) => {
      const { limit } = params
      const since =
        params.since !== undefined ? new Date(params.since).toISOString() : ''
      const includeUnspeccedTakedowns =
        auth.credentials.type === 'none' ? false : auth.credentials.isAdmin
      const labelRes = await ctx.db.db
        .selectFrom('label')
        .selectAll()
        .orderBy('label.cts', 'asc')
        .where('cts', '>', since)
        .if(!includeUnspeccedTakedowns, (q) =>
          q.where('label.val', 'not in', [
            UNSPECCED_TAKEDOWN_LABEL,
            UNSPECCED_TAKEDOWN_BLOBS_LABEL,
          ]),
        )
        .limit(limit)
        .execute()

      const labels = labelRes.map((l) => formatLabel(l))

      return {
        encoding: 'application/json',
        body: {
          labels,
        },
      }
    },
  })
}
