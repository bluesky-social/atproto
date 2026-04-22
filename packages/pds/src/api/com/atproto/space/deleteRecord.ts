import { SpaceRepo, WriteOpAction } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ScopedSpaceStorage } from '../../../../actor-store/space'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.deleteRecord, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, collection, rkey, swapCommit } = input.body

      await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new ScopedSpaceStorage(actorTxn.space, space)
        const repo = await SpaceRepo.loadOrCreate(storage, did)
        const commit = await repo.formatCommit({
          action: WriteOpAction.Delete,
          collection,
          rkey,
        })

        if (swapCommit) {
          const currentRev = await actorTxn.space.getRev(space)
          if (currentRev !== swapCommit) {
            throw new InvalidRequestError('Commit swap failed', 'InvalidSwap')
          }
        }

        await actorTxn.space.applyCommit(space, commit)
      })

      return {
        encoding: 'application/json' as const,
        body: {},
      }
    },
  })
}
