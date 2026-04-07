import { cidForLex } from '@atproto/lex-cbor'
import { Repo, WriteOpAction } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ScopedSpaceStorage } from '../../../../actor-store/space'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.putRecord, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, collection, rkey, record, swapCommit } = input.body

      const result = await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new ScopedSpaceStorage(actorTxn.space, space)
        const repo = await Repo.loadOrCreate(storage, did)
        const exists = await storage.hasRecord(collection, rkey)
        const action = exists ? WriteOpAction.Update : WriteOpAction.Create
        const commit = await repo.formatCommit({
          action,
          collection,
          rkey,
          record,
        })

        if (swapCommit) {
          const currentRev = await actorTxn.space.getRev(space)
          if (currentRev !== swapCommit) {
            throw new InvalidRequestError(
              'Commit swap failed',
              'InvalidSwap',
            )
          }
        }

        await actorTxn.space.applyCommit(space, commit)
        const cid = await cidForLex(record)
        return { cid: cid.toString() }
      })

      return {
        encoding: 'application/json' as const,
        body: {
          uri: `${space}/${did}/${collection}/${rkey}`,
          cid: result.cid,
        },
      }
    },
  })
}
