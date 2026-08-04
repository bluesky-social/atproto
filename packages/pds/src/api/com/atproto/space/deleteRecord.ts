import { ForbiddenError, Server } from '@atproto/xrpc-server'
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

      // Idempotent, as com.atproto.repo.deleteRecord is.
      const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
        const existing = await actorTxn.space.getRecord(space, collection, rkey)
        if (!existing) return null
        return actorTxn.space.applyWrites(space, [
          { action: 'delete', collection, rkey },
        ])
      })

      if (commit) {
        await fireNotifyWrite(ctx, {
          space,
          writerDid: did,
          rev: commit.rev,
          setHash: commit.setHash,
        })
      }

      return {
        encoding: 'application/json' as const,
        body: {},
      }
    },
  })
}
