import { TID } from '@atproto/common'
import { AtUriString } from '@atproto/syntax'
import {
  ForbiddenError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { SpaceWrite } from '../../../../actor-store/space/index.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

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

      // No `put` here, so every action is directly scope-checkable.
      const ops: Exclude<SpaceWrite, { action: 'put' }>[] = writes.map((w) => {
        if (com.atproto.space.applyWrites.create.isTypeOf(w)) {
          return {
            action: 'create',
            collection: w.collection,
            rkey: w.rkey ?? TID.nextStr(),
            record: w.value,
          }
        } else if (com.atproto.space.applyWrites.update.isTypeOf(w)) {
          return {
            action: 'update',
            collection: w.collection,
            rkey: w.rkey,
            record: w.value,
          }
        } else if (com.atproto.space.applyWrites.delete.isTypeOf(w)) {
          return {
            action: 'delete',
            collection: w.collection,
            rkey: w.rkey,
          }
        }
        throw new InvalidRequestError('Unknown write type')
      })

      for (const op of ops) {
        assertSpaceScope(auth, space, {
          action: op.action,
          collection: op.collection,
        })
      }

      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.space.applyWrites(space, ops),
      )

      await fireNotifyWrite(ctx, {
        space,
        writerDid: did,
        rev: commit.rev,
        setHash: commit.setHash,
      })

      return {
        encoding: 'application/json' as const,
        body: {
          results: commit.results.map((result) => {
            const uri =
              `${space}/${did}/${result.collection}/${result.rkey}` as AtUriString
            if (result.action === 'delete') {
              return com.atproto.space.applyWrites.deleteResult.build({})
            }
            const resultType =
              result.action === 'create'
                ? com.atproto.space.applyWrites.createResult
                : com.atproto.space.applyWrites.updateResult
            return resultType.build({ uri, cid: result.cid.toString() })
          }),
        },
      }
    },
  })
}
