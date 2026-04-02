import { TID } from '@atproto/common'
import { LexMap } from '@atproto/lex-data'
import { Repo, RecordWriteOp, WriteOpAction } from '@atproto/space'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { ScopedSpaceStorage } from '../../../../actor-store/space'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.applyWrites, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, writes, swapCommit } = input.body

      const ops: RecordWriteOp[] = writes.map(
        (w: { $type?: string } & Record<string, unknown>) => {
          if (w.$type === 'com.atproto.space.applyWrites#create') {
            return {
              action: WriteOpAction.Create as const,
              collection: w.collection as string,
              rkey: (w.rkey as string) ?? TID.nextStr(),
              record: w.value as LexMap,
            }
          } else if (w.$type === 'com.atproto.space.applyWrites#update') {
            return {
              action: WriteOpAction.Update as const,
              collection: w.collection as string,
              rkey: w.rkey as string,
              record: w.value as LexMap,
            }
          } else if (w.$type === 'com.atproto.space.applyWrites#delete') {
            return {
              action: WriteOpAction.Delete as const,
              collection: w.collection as string,
              rkey: w.rkey as string,
            }
          }
          throw new InvalidRequestError(`Unknown write type: ${w.$type}`)
        },
      )

      const results = await ctx.actorStore.transact(
        did,
        async (actorTxn) => {
          const storage = new ScopedSpaceStorage(actorTxn.space, space)
          const repo = await Repo.loadOrCreate(storage, did)
          const commit = await repo.formatCommit(ops)

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
          return commit.writes
        },
      )

      return {
        encoding: 'application/json' as const,
        body: {
          results: results.map((w) => {
            if (
              w.action === WriteOpAction.Create ||
              w.action === WriteOpAction.Update
            ) {
              return {
                $type: `com.atproto.space.applyWrites#${w.action}Result`,
                uri: `${space}/${w.collection}/${w.rkey}`,
                cid: w.cid.toString(),
              }
            }
            return {
              $type: 'com.atproto.space.applyWrites#deleteResult',
            }
          }),
        },
      }
    },
  })
}
