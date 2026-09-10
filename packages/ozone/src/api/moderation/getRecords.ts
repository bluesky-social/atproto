import { AtUri } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { addAccountInfoToRepoView, getPdsAccountInfos } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.getRecords, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const labelers = ctx.reqLabelers(req)

      const [records, accountInfos] = await Promise.all([
        ctx.modService(db).views.recordDetails(
          params.uris.map((uri) => ({ uri })),
          labelers,
        ),
        getPdsAccountInfos(
          ctx,
          params.uris.map((uri) => new AtUri(uri).hostname),
        ),
      ])

      const results = params.uris.map((uri) => {
        const record = records.get(uri)
        if (!record) {
          return tools.ozone.moderation.defs.recordViewNotFound.$build({ uri })
        }

        return tools.ozone.moderation.defs.recordViewDetail.$build({
          ...record,
          repo: addAccountInfoToRepoView(
            record.repo,
            accountInfos.get(record.repo.did) || null,
            auth.credentials.isModerator,
          ),
        })
      })

      return {
        encoding: 'application/json',
        body: { records: results },
      }
    },
  })
}
