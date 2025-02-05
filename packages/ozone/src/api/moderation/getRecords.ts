import { AtUri } from '@atproto/syntax'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { addAccountInfoToRepoView, getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getRecords({
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
          return {
            uri,
            $type: 'tools.ozone.moderation.defs#recordViewNotFound',
          }
        }

        return {
          $type: 'tools.ozone.moderation.defs#recordViewDetail',
          ...record,
          repo: addAccountInfoToRepoView(
            record.repo,
            accountInfos.get(record.repo.did) || null,
            auth.credentials.isModerator,
          ),
        }
      })

      return {
        encoding: 'application/json',
        body: { records: results },
      }
    },
  })
}
