import type { Server } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import { assertSpaceRead, isSpaceUserOrAdmin, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listBlobs, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      additional: [AuthScope.Takendown],
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, limit, cursor } = params

      assertSpaceRead(auth, toSpaceRef(space), repo)
      await assertRepoAvailability(ctx, repo, isSpaceUserOrAdmin(auth, repo))

      const cids = await ctx.actorStore.read(repo, (store) =>
        store.space.listBlobs(space, { cursor, limit }),
      )

      return {
        encoding: 'application/json',
        body: {
          cids,
          cursor: cids.length < limit ? undefined : cids.at(-1),
        },
      }
    },
  })
}
