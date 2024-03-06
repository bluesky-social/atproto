import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { addAccountInfoToRepoView, getPdsAccountInfo } from './util'
import { AtUri } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.authVerifier.modOrRole,
    handler: async ({ params, auth }) => {
      const db = ctx.db

      const [record, accountInfo] = await Promise.all([
        ctx.modService(db).views.recordDetail(params),
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
