import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertSpaceAuthority,
  fireNotifyRepoUpdate,
  toSpaceRef,
} from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.updateSpace, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const authorityDid = auth.credentials.did
      const { space, policy } = body
      const ref = toSpaceRef(space)

      assertSpaceAuthority(auth, ref, { manage: 'update' })

      const commit = await ctx.spacePolicyManager.updateSpace(ref, policy)
      await fireNotifyRepoUpdate(ctx, {
        space: ref,
        writerDid: authorityDid,
        commit,
      })
    },
  })
}
