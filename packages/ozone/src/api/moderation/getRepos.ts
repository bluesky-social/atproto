import { Server } from '../../lexicon'
import AppContext from '../../context'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfo } from '../util'
import {
  RepoViewDetail,
  RepoViewNotFound,
} from '../../lexicon/types/tools/ozone/moderation/defs'

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

      const repos: (RepoViewDetail | RepoViewNotFound)[] = []

      dids.forEach((did) => {
        const partialRepo = partialRepos.get(did)
        if (!partialRepo) {
          repos.push({
            did,
            $type: 'tools.ozone.moderation.defs#repoViewNotFound',
          })
          return
        }
        repos.push({
          $type: 'tools.ozone.moderation.defs#repoViewDetail',
          ...addAccountInfoToRepoViewDetail(
            partialRepo,
            accountInfo.get(did) || null,
            auth.credentials.isModerator,
          ),
        })
      })

      return {
        encoding: 'application/json',
        body: { repos },
      }
    },
  })
}
