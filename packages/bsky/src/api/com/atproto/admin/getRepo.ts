import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfo } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRepo({
    auth: ctx.roleVerifier,
    handler: async ({ params, auth }) => {
      const { did } = params
      const db = ctx.db.getPrimary()
      const result = await ctx.services.actor(db).getActor(did, true)
      if (!result) {
        throw new InvalidRequestError('Repo not found', 'RepoNotFound')
      }
      const [partialRepo, accountInfo] = await Promise.all([
        ctx.services.moderation(db).views.repoDetail(result),
        getPdsAccountInfo(ctx, result.did),
      ])

      const repo = addAccountInfoToRepoViewDetail(
        partialRepo,
        accountInfo,
        auth.credentials.moderator,
      )
      return {
        encoding: 'application/json',
        body: repo,
      }
    },
  })
}
