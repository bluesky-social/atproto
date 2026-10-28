import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner, fireNotifyWrite } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.updateSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, policy } = input.body

      assertSpaceOwner(auth, space, { manage: 'update' })

      const commit = await ctx.spacePolicyManager.updateSpace(space, policy)
      await fireNotifyWrite(ctx, { space, writerDid: ownerDid, commit })
    },
  })
}
