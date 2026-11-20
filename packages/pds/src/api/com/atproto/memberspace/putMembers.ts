import type { Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertSpaceAuthority,
  fireNotifyRepoUpdate,
  forwardWriterRemoved,
  toSpaceRef,
} from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.memberspace.putMembers, {
    auth: ctx.authVerifier.authorization({
      scopes: ACCESS_FULL,
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    rateLimit: [
      {
        name: 'space-write-hour',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: ({ input }) => 2 * input.body.members.length,
      },
      {
        name: 'space-write-day',
        calcKey: ({ auth }) => auth.credentials.did,
        calcPoints: ({ input }) => 2 * input.body.members.length,
      },
    ],
    handler: async ({ input: { body }, auth }) => {
      const authorityDid = auth.credentials.did
      const { space, members } = body

      const ref = toSpaceRef(space)
      assertSpaceAuthority(auth, ref, { manage: 'update' })

      const { commit, removedWriters } =
        await ctx.spacePolicyManager.putMembers(ref, members)
      for (const removed of removedWriters) {
        forwardWriterRemoved(ctx, ref, removed)
      }
      await fireNotifyRepoUpdate(ctx, {
        space: ref,
        writerDid: authorityDid,
        commit,
      })
    },
  })
}
