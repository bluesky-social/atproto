import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { prepareDelete } from '../../../../repo/index.js'
import { assertNotPolicyRecord } from '../../../../space-policy/publish.js'
import { fireNotifyRepoUpdate, toSpaceRef } from './util.js'

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
    handler: async ({ input: { body }, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey } = body
      const ref = toSpaceRef(space)
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }
      assertNotPolicyRecord(collection)

      auth.credentials.permissions?.assertSpace(ref, {
        action: 'delete',
        collection,
      })

      const write = prepareDelete({ did, space: ref, collection, rkey })

      // Idempotent, as com.atproto.repo.deleteRecord is.
      const uri = ref.recordUri(did, collection, rkey)
      const commit = await ctx.actorStore.transact(did, async (actorTxn) => {
        const exists = await actorTxn.space.hasRecord(uri.toString())
        if (!exists) return null
        return actorTxn.space.applyWrites(ref, [write])
      })

      await fireNotifyRepoUpdate(ctx, { space: ref, writerDid: did, commit })

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
