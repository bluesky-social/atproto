import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { prepareCreate } from '../../../../repo/index.js'
import { assertNotPolicyRecord } from '../../../../space-policy/publish.js'
import { fireNotifyRepoUpdate, toSpaceRef } from './util.js'

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
    handler: async ({ input: { body }, auth }) => {
      const did = auth.credentials.did
      const { space, repo, collection, rkey, record } = body
      const ref = toSpaceRef(space)
      if (repo !== did) {
        throw new ForbiddenError('repo must match authenticated user')
      }
      assertNotPolicyRecord(collection)

      auth.credentials.permissions?.assertSpace(ref, {
        action: 'create',
        collection,
      })

      const write = await prepareCreate({
        did,
        space: ref,
        collection,
        rkey,
        record,
        validate: body.validate,
      })

      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.space.applyWrites(ref, [write]),
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
