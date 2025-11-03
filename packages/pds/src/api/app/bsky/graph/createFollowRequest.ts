import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.createFollowRequest({
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: (permissions) => {
        const lxm = ids.AppBskyGraphCreateFollowRequest
        permissions.assertRpc({ aud: null as unknown as string, lxm })
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
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const { subject } = input.body

      // Verify the subject exists
      try {
        const resolved = await ctx.idResolver.did.resolve(subject)
        if (!resolved) {
          throw new InvalidRequestError('Subject not found', 'SubjectNotFound')
        }
      } catch (err) {
        throw new InvalidRequestError('Subject not found', 'SubjectNotFound')
      }

      // Check if the target profile is private
      const isPrivate = await ctx.actorStore.read(
        subject,
        async (actorStore) => {
          const prefs = await actorStore.pref.getPreferences(
            'app.bsky',
            {} as any,
          )
          const privacyPref = prefs.find(
            (p) => p.$type === 'app.bsky.actor.privacySettings',
          )
          return (privacyPref as any)?.isPrivate || false
        },
      )

      if (!isPrivate) {
        throw new InvalidRequestError(
          'Profile is not private. Use regular follow instead.',
          'ProfileNotPrivate',
        )
      }

      // Check for existing follow request (duplicate detection)
      const existingRequests = await ctx.actorStore.read(
        requester,
        async (store) => {
          return store.record.listRecordsForCollection({
            collection: 'app.bsky.graph.followRequest',
          })
        },
      )

      const hasPendingRequest = existingRequests.some((r) => {
        const record = r.value as any
        return record.subject === subject && record.status === 'pending'
      })

      if (hasPendingRequest) {
        throw new InvalidRequestError(
          'A pending follow request to this subject already exists',
          'DuplicateRequest',
        )
      }

      // Create the follow request record
      const record = {
        $type: 'app.bsky.graph.followRequest',
        subject,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      }

      const result = await ctx.actorStore.transact(
        requester,
        async (actorTxn) => {
          const prepared = await actorTxn.repo.prepareCreate({
            collection: 'app.bsky.graph.followRequest',
            record,
          })
          const commit = await actorTxn.repo.processWrites({
            writes: [prepared],
            swapCommitCid: null,
          })
          return { uri: prepared.uri, cid: commit.cid }
        },
      )

      return {
        encoding: 'application/json' as const,
        body: {
          uri: result.uri.toString(),
          cid: result.cid.toString(),
        },
      }
    },
  })
}
