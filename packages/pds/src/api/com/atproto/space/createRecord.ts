import { TID } from '@atproto/common'
import { cidForLex } from '@atproto/lex-cbor'
import { SpaceRepo, WriteOpAction } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ScopedSpaceStorage } from '../../../../actor-store/space'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createRecord, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, collection, record, swapCommit } = input.body
      const rkey = input.body.rkey ?? TID.nextStr()

      const result = await ctx.actorStore.transact(did, async (actorTxn) => {
        const storage = new ScopedSpaceStorage(actorTxn.space, space)
        const repo = await SpaceRepo.loadOrCreate(storage, did)
        const commit = await repo.formatCommit({
          action: WriteOpAction.Create,
          collection,
          rkey,
          record,
        })

        if (swapCommit) {
          const currentRev = await actorTxn.space.getRev(space)
          if (currentRev !== swapCommit) {
            throw new InvalidRequestError('Commit swap failed', 'InvalidSwap')
          }
        }

        await actorTxn.space.applyCommit(space, commit)
        const cid = await cidForLex(record)
        return { cid: cid.toString(), rkey }
      })

      return {
        encoding: 'application/json' as const,
        body: {
          uri: `${space}/${did}/${collection}/${result.rkey}`,
          cid: result.cid,
        },
      }
    },
  })
}
