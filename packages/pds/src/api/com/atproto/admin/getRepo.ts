import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRepo({
    auth: ctx.moderatorVerifier,
    handler: async ({ params }) => {
      const { db, services } = ctx
      const { did } = params
      const result = await services.account(db).getAccount(did, true)
      if (!result) throw new InvalidRequestError('Repo not found')
      return {
        encoding: 'application/json',
        body: await services.moderation(db).views.repoDetail(result),
      }
    },
  })
}
