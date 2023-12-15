import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { addAccountInfoToRepoView, getPdsAccountInfo } from './util'
import { AtUri } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.roleVerifier,
    handler: async ({ params, auth }) => {
      const db = ctx.db

      const uri = new AtUri(params.uri)

      const [record, accountInfo] = await Promise.all([
        ctx.services.moderation(db).views.recordDetail(uri),
        getPdsAccountInfo(ctx, uri.hostname),
      ])

      if (!record) {
        throw new InvalidRequestError('Record not found', 'RecordNotFound')
      }

      record.repo = addAccountInfoToRepoView(
        record.repo,
        accountInfo,
        auth.credentials.moderator,
      )

      return {
        encoding: 'application/json',
        body: record,
      }
    },
  })
}
