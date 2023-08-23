import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRepo({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { did } = params
      const db = ctx.db.getPrimary()
      const result = await ctx.services.actor(db).getActor(did, true)
      if (!result) {
        throw new InvalidRequestError('Repo not found', 'RepoNotFound')
      }
      return {
        encoding: 'application/json',
        body: await ctx.services.moderation(db).views.repoDetail(result),
      }
    },
  })
}
