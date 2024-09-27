import { Server } from '../../lexicon'
import AppContext from '../../context'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfo } from '../util'
import { RepoViewDetail } from '../../lexicon/types/tools/ozone/moderation/defs'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.getRepos({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const { dids } = params
      const db = ctx.db
      const labelers = ctx.reqLabelers(req)
      const [partialRepos, accountInfo] = await Promise.all([
        ctx.modService(db).views.repoDetail(dids, labelers),
        getPdsAccountInfo(ctx, dids),
      ])

      const repos: RepoViewDetail[] = []

      partialRepos.forEach((partialRepo, did) =>
        repos.push(
          addAccountInfoToRepoViewDetail(
            partialRepo,
            accountInfo.get(did) || null,
            auth.credentials.isModerator,
          ),
        ),
      )

      return {
        encoding: 'application/json',
        body: { repos },
      }
    },
  })
}
