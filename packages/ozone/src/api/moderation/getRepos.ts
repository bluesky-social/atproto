import { Server } from '../../lexicon'
import AppContext from '../../context'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getRepos({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const { dids } = params
      const db = ctx.db
      const labelers = ctx.reqLabelers(req)
      const [partialRepos, accountInfo] = await Promise.all([
        ctx.modService(db).views.repoDetails(dids, labelers),
        getPdsAccountInfos(ctx, dids),
      ])

      const repos = dids.map((did) => {
        const partialRepo = partialRepos.get(did)
        if (!partialRepo) {
          return {
            did,
            $type: 'tools.ozone.moderation.defs#repoViewNotFound',
          }
        }
        return {
          $type: 'tools.ozone.moderation.defs#repoViewDetail',
          ...addAccountInfoToRepoViewDetail(
            partialRepo,
            accountInfo.get(did) || null,
            auth.credentials.isModerator,
          ),
        }
      })

      return {
        encoding: 'application/json',
        body: { repos },
      }
    },
  })
}
