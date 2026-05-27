import { TID } from '@atproto/common'
import { RecordWriteOp, SpaceRepo, WriteOpAction } from '@atproto/space'
import { SpaceUriString } from '@atproto/syntax'
import {
  ForbiddenError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { SqlRepoStorage } from '../../../../actor-store/space/index.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

const writeOpToAction = {
  [WriteOpAction.Create]: 'create' as const,
  [WriteOpAction.Update]: 'update' as const,
  [WriteOpAction.Delete]: 'delete' as const,
}

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.applyWrites, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, writes } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

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

      for (const op of ops) {
        assertSpaceScope(auth, space, {
          action: writeOpToAction[op.action],
          collection: op.collection,
        })
      }

      const { results, rev } = await ctx.actorStore.transact(
        did,
        async (actorTxn) => {
          const storage = new SqlRepoStorage(actorTxn.space, space)
          const repoStore = await SpaceRepo.loadOrCreate(storage, did)
          const commit = await repoStore.formatCommit(ops)
          const rev = await actorTxn.space.applyRepoCommit(space, commit)
          return { results: commit.writes, rev }
        },
      )

      await fireNotifyWrite(ctx, space, did, rev)

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
                uri:
                  `${space}/${did}/${w.collection}/${w.rkey}` as SpaceUriString,
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
