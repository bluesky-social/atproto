import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner, assertSpaceScope } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.updateSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const { space, policy, appAccess } = input.body

      assertSpaceScope(auth, space, { manage: 'update' })
      assertSpaceOwner(auth.credentials.did, space)

      await ctx.simpleSpaceManager.updateSpace(space, { policy, appAccess })
    },
  })
}
