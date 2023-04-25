import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { adminVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: adminVerifier(ctx.cfg.adminPassword),
    handler: async ({ params }) => {
      const { db, services } = ctx
      const { uri, cid } = params
      const result = await db.db
        .selectFrom('record')
        .selectAll()
        .where('uri', '=', uri)
        .if(!!cid, (qb) => qb.where('cid', '=', cid ?? ''))
        .executeTakeFirst()
      if (!result) throw new InvalidRequestError('Record not found')
      return {
        encoding: 'application/json',
        body: await services.moderation(db).views.recordDetail(result),
      }
    },
  })
}
