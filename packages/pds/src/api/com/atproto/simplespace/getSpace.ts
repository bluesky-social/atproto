import type { Server } from '@atproto/xrpc-server'
import { isSpaceCredentialOutput } from '../../../../auth-output.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertCredentialSpace, assertSpaceOwner } from '../space/util.js'

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

      if (isSpaceCredentialOutput(auth)) {
        assertCredentialSpace(auth.credentials, space)
      } else {
        assertSpaceOwner(auth, space, { action: 'read_self' })
      }

      return {
        encoding: 'application/json' as const,
        body: await ctx.simpleSpaceManager.getSpace(space),
      }
    },
  })
}
