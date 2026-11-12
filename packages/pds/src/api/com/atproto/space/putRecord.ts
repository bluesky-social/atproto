import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { prepareCreate, prepareUpdate } from '../../../../repo/index.js'
import { assertNotPolicyRecord } from '../../../../space-policy/publish.js'
import { fireNotifyRepoUpdate, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.putRecord, {
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
        calcPoints: () => 2,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 2,
      },
    ],
    opts: {
      jsonLimit: 1_000_000,
    },
    handler: async ({ input: { body }, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey, record } = body
      const ref = toSpaceRef(space)
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }
      assertNotPolicyRecord(collection)

      const { commit, write } = await ctx.actorStore.transact(
        did,
        async (actorTxn) => {
          // Resolve to what this write actually is, so an app granted only `update`
          // isn't asked for `create` too.
          const uri = ref.recordUri(did, collection, rkey)
          const exists = await actorTxn.space.hasRecord(uri.toString())

          auth.credentials.permissions?.assertSpace(ref, {
            action: exists ? 'update' : 'create',
            collection,
          })

          const writeInfo = {
            did,
            space: ref,
            collection,
            rkey,
            record,
            validate: body.validate,
          }
          const write = exists
            ? await prepareUpdate(writeInfo)
            : await prepareCreate(writeInfo)

          const commit = await actorTxn.space.applyWrites(ref, [write])
          return { commit, write }
        },
      )

      await fireNotifyRepoUpdate(ctx, { space: ref, writerDid: did, commit })

      return {
        encoding: 'application/json',
        body: {
          uri: write.uri.toString(),
          cid: write.cid.toString(),
          validationStatus: write.validationStatus,
        },
      }
    },
  })
}
