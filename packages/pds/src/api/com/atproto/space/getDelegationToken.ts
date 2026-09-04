import { createSpaceToken, spaceHostAud } from '@atproto/space'
import type { Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getDelegationToken, {
    auth: ctx.authVerifier.authorization({
      scopes: ACCESS_FULL,
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const userDid = auth.credentials.did
      const { space } = params

      assertSpaceScope(auth, space, { action: 'read' })

      const { spaceDid } = toSpaceRef(space)
      const keypair = await ctx.actorStore.keypair(userDid)

      const token = await createSpaceToken(
        'delegation',
        {
          iss: userDid,
          sub: space,
          aud: spaceHostAud(spaceDid),
        },
        keypair,
      )

      return {
        encoding: 'application/json' as const,
        body: { token },
      }
    },
  })
}
