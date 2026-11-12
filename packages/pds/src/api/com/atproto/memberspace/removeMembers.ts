import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertSpaceAuthority,
  fireNotifyRepoUpdate,
  forwardWriterRemoved,
  toSpaceRef,
} from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.memberspace.removeMembers, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const authorityDid = auth.credentials.did
      const { space, dids } = body

      const ref = toSpaceRef(space)
      assertSpaceAuthority(auth, ref, { manage: 'update' })

      const { commit, removedWriters } =
        await ctx.spacePolicyManager.removeMembers(ref, dids)
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
