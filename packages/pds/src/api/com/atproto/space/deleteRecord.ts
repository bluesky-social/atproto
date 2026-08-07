import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { prepareDelete, spaceRecordUri } from '../../../../repo/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.deleteRecord, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    rateLimit: [
      {
        name: 'repo-write-hour',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 1,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 1,
      },
    ],
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

      assertSpaceScope(auth, space, { action: 'delete', collection })

      const write = prepareDelete({ did, space, collection, rkey })

      // Idempotent, as com.atproto.repo.deleteRecord is.
      const uri = spaceRecordUri(space, did, collection, rkey)
      const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
        const exists = await actorTxn.space.hasRecord(uri.toString())
        if (!exists) return null
        return actorTxn.space.applyWrites(space, [write])
      })

      await fireNotifyWrite(ctx, { space, writerDid: did, commit })

      return {
        encoding: 'application/json' as const,
        body: {},
      }
    },
  })
}
