import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfos } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.getRepos, {
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
            $type: 'tools.ozone.moderation.defs#repoViewNotFound' as const,
          }
        }
        return {
          ...addAccountInfoToRepoViewDetail(
            partialRepo,
            accountInfo.get(did) || null,
            auth.credentials.isModerator,
          ),
          $type: 'tools.ozone.moderation.defs#repoViewDetail' as const,
        }
      })

      return {
        encoding: 'application/json',
        body: { repos },
      }
    },
  })
}
