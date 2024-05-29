import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfo } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getRepo({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const { did } = params
      const db = ctx.db
      const labelers = ctx.reqLabelers(req)
      const [partialRepo, accountInfo] = await Promise.all([
        ctx.modService(db).views.repoDetail(did, labelers),
        getPdsAccountInfo(ctx, did),
      ])
      if (!partialRepo) {
        throw new InvalidRequestError('Repo not found', 'RepoNotFound')
      }

      const repo = addAccountInfoToRepoViewDetail(
        partialRepo,
        accountInfo,
        auth.credentials.isModerator,
      )
      return {
        encoding: 'application/json',
        body: repo,
      }
    },
  })
}
