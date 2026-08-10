import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertCredentialSpace, assertSpaceScope } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.getSpace, {
    // An OAuth token is audience-bound to its own PDS, so a member hosted
    // elsewhere presents a space credential instead.
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space } = params

      if (auth.credentials.type === 'space_credential') {
        assertCredentialSpace(auth.credentials, space)
      } else {
        // Whole-space `read`: the config describes the space, not one repo in it.
        assertSpaceScope(auth, space, { action: 'read' })
      }

      return {
        encoding: 'application/json' as const,
        body: await ctx.simpleSpaceManager.getSpace(space),
      }
    },
  })
}
