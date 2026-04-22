import { TID } from '@atproto/common'
import { RecordWriteOp, SpaceRepo, WriteOpAction } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ScopedSpaceRepoStorage } from '../../../../actor-store/space'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.applyWrites, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, writes, swapCommit } = input.body

      const ops: RecordWriteOp[] = writes.map((w) => {
        if (com.atproto.space.applyWrites.create.isTypeOf(w)) {
          return {
            action: WriteOpAction.Create as const,
            collection: w.collection,
            rkey: w.rkey ?? TID.nextStr(),
            record: w.value,
          }
        } else if (com.atproto.space.applyWrites.update.isTypeOf(w)) {
          return {
            action: WriteOpAction.Update as const,
            collection: w.collection,
            rkey: w.rkey,
            record: w.value,
          }
        } else if (com.atproto.space.applyWrites.delete.isTypeOf(w)) {
          return {
            action: WriteOpAction.Delete as const,
            collection: w.collection,
            rkey: w.rkey,
          }
        }
        throw new InvalidRequestError('Unknown write type')
      })

      const results = await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new ScopedSpaceRepoStorage(actorTxn.space, space)
        const repo = await SpaceRepo.loadOrCreate(storage, did)
        const commit = await repo.formatCommit(ops)

        if (swapCommit) {
          const currentRev = await actorTxn.space.getRev(space)
          if (currentRev !== swapCommit) {
            throw new InvalidRequestError('Commit swap failed', 'InvalidSwap')
          }
        }

        await actorTxn.space.applyCommit(space, commit)
        return commit.writes
      })

      return {
        encoding: 'application/json' as const,
        body: {
          results: results.map((w) => {
            if (
              w.action === WriteOpAction.Create ||
              w.action === WriteOpAction.Update
            ) {
              const resultType =
                w.action === WriteOpAction.Create
                  ? com.atproto.space.applyWrites.createResult
                  : com.atproto.space.applyWrites.updateResult
              return resultType.build({
                uri: `${space}/${did}/${w.collection}/${w.rkey}`,
                cid: w.cid.toString(),
              })
            }
            return com.atproto.space.applyWrites.deleteResult.build({})
          }),
        },
      }
    },
  })
}
