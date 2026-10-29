import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.clearRecords, {
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
      const { space, repo } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

      const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
        const collections = await actorTxn.space.listCollections(space)
        for (const collection of collections) {
          auth.credentials.permissions?.assertSpaceRef(space, {
            action: 'delete',
            collection,
          })
        }
        return actorTxn.space.clearRecords(space)
      })

      await fireNotifyWrite(ctx, { space, writerDid: did, commit })

      return {
        encoding: 'application/json' as const,
        body: {},
      }
    },
  })
}
