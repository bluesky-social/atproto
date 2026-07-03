import { SpaceRepo, WriteOpAction } from '@atproto/space'
import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { SqlRepoStorage } from '../../../../actor-store/space/index.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.deleteRecord, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

      assertSpaceScope(auth, space, { action: 'delete', collection })

      const result = await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new SqlRepoStorage(actorTxn.space, space)
        const repoStore = await SpaceRepo.loadOrCreate(storage, did)
        const commit = await repoStore.formatCommit({
          action: WriteOpAction.Delete,
          collection,
          rkey,
        })
        const rev = await actorTxn.space.applyRepoCommit(space, commit)
        return { rev, setHash: commit.setHash }
      })

      await fireNotifyWrite(ctx, space, did, result.rev, result.setHash)

      return {
        encoding: 'application/json' as const,
        body: {},
      }
    },
  })
}
