import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { addAccountInfoToRepoView, getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getRecord({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const labelers = ctx.reqLabelers(req)

      const [records, accountInfos] = await Promise.all([
        ctx.modService(db).views.recordDetails([params], labelers),
        getPdsAccountInfos(ctx, [new AtUri(params.uri).hostname]),
      ])

      const record = records.get(params.uri)

      if (!record) {
        throw new InvalidRequestError(
          `Could not locate record: ${params.uri}`,
          'RecordNotFound',
        )
      }

      record.repo = addAccountInfoToRepoView(
        record.repo,
        accountInfos.get(record.repo.did) || null,
        auth.credentials.isModerator,
      )

      return {
        encoding: 'application/json',
        body: record,
      }
    },
  })
}
