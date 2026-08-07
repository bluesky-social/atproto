import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { prepareCreate } from '../../../../repo/index.js'
import { assertSpaceScope, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createRecord, {
    auth: ctx.authVerifier.authorization({
      // Checkable during auth, unlike com.atproto.repo.createRecord: `repo` here
      // is always a did, and the handler requires it to be the caller's own.
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
        calcPoints: () => 3,
      },
      {
        name: 'repo-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: () => 3,
      },
    ],
    opts: {
      jsonLimit: 1_000_000,
    },
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey, record } = input.body
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }

      assertSpaceScope(auth, space, { action: 'create', collection })

      const write = await prepareCreate({
        did,
        space,
        collection,
        rkey,
        record,
        validate: input.body.validate,
      })

      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.space.applyWrites(space, [write]),
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
