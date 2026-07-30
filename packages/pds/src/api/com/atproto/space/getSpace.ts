import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { toLexSpaceConfig } from '../simplespace/config.js'
import { toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const callerDid = auth.credentials.did
      const { space } = params

      const { spaceDid } = toSpaceRef(space)
      // Served by the space host (the authority's PDS).
      if (spaceDid !== callerDid) {
        throw new InvalidRequestError(
          'getSpace must be called on the space authority',
          'SpaceNotFound',
        )
      }

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
