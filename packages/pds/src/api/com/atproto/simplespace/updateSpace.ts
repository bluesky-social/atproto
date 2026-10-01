import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.updateSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const { space, readPolicy, writePolicy, appAccess } = input.body

      assertSpaceOwner(auth, space, { manage: 'update' })

      await ctx.simpleSpaceManager.updateSpace(space, {
        readPolicy,
        writePolicy,
        appAccess,
      })
    },
  })
}
