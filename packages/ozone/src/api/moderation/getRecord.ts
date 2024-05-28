import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { addAccountInfoToRepoView, getPdsAccountInfo } from '../util'
import { AtUri } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getRecord({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const labelers = ctx.reqLabelers(req)

      const [record, accountInfo] = await Promise.all([
        ctx.modService(db).views.recordDetail(params, labelers),
        getPdsAccountInfo(ctx, new AtUri(params.uri).hostname),
      ])

      if (!record) {
        throw new InvalidRequestError('Record not found', 'RecordNotFound')
      }

      record.repo = addAccountInfoToRepoView(
        record.repo,
        accountInfo,
        auth.credentials.isModerator,
      )

      return {
        encoding: 'application/json',
        body: record,
      }
    },
  })
}
