import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AtUri } from '@atproto/uri'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.roleVerifier,
    handler: async ({ params, auth }) => {
      const access = auth.credentials
      const { db, services } = ctx
      const { uri, cid } = params
      const result = await services
        .record(db)
        .getRecord(new AtUri(uri), cid ?? null, true)
      if (!result) {
        throw new InvalidRequestError('Record not found', 'RecordNotFound')
      }
      return {
        encoding: 'application/json',
        body: await services.moderation(db).views.recordDetail(result, {
          includeEmails: access.moderator,
        }),
      }
    },
  })
}
