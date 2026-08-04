import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { toLexSpaceConfig } from '../simplespace/config.js'
import { assertCredentialSpace, assertSpaceScope, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpace, {
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

      const { spaceDid } = toSpaceRef(space)
      const spaceRow = await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow || spaceRow.deletedAt || !spaceRow.isOwner) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }

      return {
        encoding: 'application/json' as const,
        body: {
          uri: space,
          config: toLexSpaceConfig(spaceRow),
        },
      }
    },
  })
}
