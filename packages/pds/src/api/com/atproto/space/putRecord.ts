import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  prepareCreate,
  prepareUpdate,
  spaceRecordUri,
} from '../../../../repo/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.putRecord, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey, record } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

      const { commit, write } = await ctx.actorStore.transact(
        did,
        async (actorTxn) => {
          // Resolve to what this write actually is, so an app granted only `update`
          // isn't asked for `create` too.
          const uri = spaceRecordUri(space, did, collection, rkey)
          const exists = await actorTxn.space.hasRecord(uri.toString())
          assertSpaceScope(auth, space, {
            action: exists ? 'update' : 'create',
            collection,
          })

          const writeInfo = {
            did,
            space,
            collection,
            rkey,
            record,
            validate: input.body.validate,
          }
          const write = exists
            ? await prepareUpdate(writeInfo)
            : await prepareCreate(writeInfo)

          const commit = await actorTxn.space.applyWrites(space, [write])
          return { commit, write }
        },
      )

      await fireNotifyWrite(ctx, { space, writerDid: did, commit })

      return {
        encoding: 'application/json' as const,
        body: {
          uri: write.uri.toString(),
          cid: write.cid.toString(),
          validationStatus: write.validationStatus,
        },
      }
    },
  })
}
