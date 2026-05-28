import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const ownerDid = auth.credentials.did
      const { space } = params

      assertSpaceScope(auth, space, { action: 'manage' })

      const spaceDid = new SpaceUri(space).spaceDid
      if (spaceDid !== ownerDid) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      const spaceRow = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow || spaceRow.deletedAt) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (!spaceRow.isOwner) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      return {
        encoding: 'application/json' as const,
        body: {
          uri: space,
          isOwner: spaceRow.isOwner,
          isPublic: spaceRow.isPublic,
          managingApp: spaceRow.managingApp ?? undefined,
          appAccessMode: spaceRow.appAccessMode,
          appExceptions: spaceRow.appExceptions,
        },
      }
    },
  })
}
