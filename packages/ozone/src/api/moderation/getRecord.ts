import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { addAccountInfoToRepoView, getPdsAccountInfos } from '../util'
import { AtUri } from '@atproto/syntax'

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
        throw new InvalidRequestError('Record not found', 'RecordNotFound')
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
