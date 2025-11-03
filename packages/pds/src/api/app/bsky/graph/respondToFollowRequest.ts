import { AtUri } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.respondToFollowRequest({
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: (permissions) => {
        const lxm = ids.AppBskyGraphRespondToFollowRequest
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
      const userDid = auth.credentials.did
      const { requestUri, response } = input.body

      // Validate response
      if (response !== 'approve' && response !== 'deny') {
        throw new InvalidRequestError(
          'Response must be either "approve" or "deny"',
          'InvalidResponse',
        )
      }

      // Parse the request URI
      let uri: AtUri
      try {
        uri = new AtUri(requestUri)
      } catch (err) {
        throw new InvalidRequestError(
          'Invalid request URI',
          'RequestNotFound',
        )
      }

      const requesterDid = uri.hostname
      const rkey = uri.rkey

      // Fetch the follow request record
      const request = await ctx.actorStore.read(
        requesterDid,
        async (store) => {
          return store.record.getRecord(
            'app.bsky.graph.followRequest',
            rkey,
          )
        },
      )

      if (!request) {
        throw new InvalidRequestError(
          'Follow request not found',
          'RequestNotFound',
        )
      }

      const requestRecord = request.value as any

      // Verify the authenticated user is the subject of the request
      if (requestRecord.subject !== userDid) {
        throw new AuthRequiredError(
          'Not authorized to respond to this request',
          'NotAuthorized',
        )
      }

      // Update the follow request status
      const newStatus = response === 'approve' ? 'approved' : 'denied'
      const updatedRecord = {
        ...requestRecord,
        status: newStatus,
        respondedAt: new Date().toISOString(),
      }

      const updateResult = await ctx.actorStore.transact(
        requesterDid,
        async (actorTxn) => {
          const prepared = await actorTxn.repo.prepareUpdate({
            collection: 'app.bsky.graph.followRequest',
            rkey,
            record: updatedRecord,
            swapCid: request.cid,
          })
          const commit = await actorTxn.repo.processWrites({
            writes: [prepared],
            swapCommitCid: null,
          })
          return { uri: prepared.uri, cid: commit.cid }
        },
      )

      let followRecord: { uri: string; cid: string } | undefined

      // If approved, create the follow record
      if (response === 'approve') {
        const followRecordData = {
          $type: 'app.bsky.graph.follow',
          subject: userDid,
          createdAt: new Date().toISOString(),
        }

        followRecord = await ctx.actorStore.transact(
          requesterDid,
          async (actorTxn) => {
            const prepared = await actorTxn.repo.prepareCreate({
              collection: 'app.bsky.graph.follow',
              record: followRecordData,
            })
            const commit = await actorTxn.repo.processWrites({
              writes: [prepared],
              swapCommitCid: null,
            })
            return {
              uri: prepared.uri.toString(),
              cid: commit.cid.toString(),
            }
          },
        )
      }

      return {
        encoding: 'application/json' as const,
        body: {
          request: {
            uri: updateResult.uri.toString(),
            cid: updateResult.cid.toString(),
          },
          followRecord,
        },
      }
    },
  })
}
