import { TID } from '@atproto/common'
import { AtUriString } from '@atproto/syntax'
import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { prepareWrite } from '../../../../repo/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createRecord, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, record } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }
      const rkey = input.body.rkey ?? TID.nextStr()

      assertSpaceScope(auth, space, { action: 'create', collection })

      const prepared = await prepareWrite({
        did,
        space,
        collection,
        rkey,
        record,
        validate: input.body.validate,
      })

      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.space.applyWrites(space, [
          {
            action: 'create',
            collection,
            rkey,
            record: prepared.record,
            blobs: prepared.blobs,
          },
        ]),
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
          uri: prepared.uri.toString() as AtUriString,
          cid: prepared.cid.toString(),
          validationStatus: prepared.validationStatus,
        },
      }
    },
  })
}
