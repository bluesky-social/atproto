import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { uri, cid } = params
      const db = ctx.db.getPrimary()
      const result = await db.db
        .selectFrom('record')
        .selectAll()
        .where('uri', '=', uri)
        .if(!!cid, (qb) => qb.where('cid', '=', cid ?? ''))
        .executeTakeFirst()
      if (!result) {
        throw new InvalidRequestError('Record not found', 'RecordNotFound')
      }
      return {
        encoding: 'application/json',
        body: await ctx.services.moderation(db).views.recordDetail(result),
      }
    },
  })
}
