import { SpaceRepo, WriteOpAction } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
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
      const { space, collection, rkey, swapCommit } = input.body

      assertSpaceScope(auth, space, { action: 'delete', collection })

      const rev = await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new SqlRepoStorage(actorTxn.space, space)
        const repo = await SpaceRepo.loadOrCreate(storage, did)
        const commit = await repo.formatCommit({
          action: WriteOpAction.Delete,
          collection,
          rkey,
        })

        if (swapCommit) {
          const state = await actorTxn.space.getRepoState(space)
          if (state?.rev !== swapCommit) {
            throw new InvalidRequestError('Commit swap failed', 'InvalidSwap')
          }
        }

        return actorTxn.space.applyRepoCommit(space, commit)
      })

      await fireNotifyWrite(ctx, space, did, rev)

      return {
        encoding: 'application/json' as const,
        body: {},
      }
    },
  })
}
