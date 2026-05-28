import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.updateSpaceConfig, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, managingApp, isPublic, appAccessMode, appExceptions } =
        input.body

      assertSpaceScope(auth, space, { action: 'manage' })

      const spaceDid = new SpaceUri(space).spaceDid
      if (spaceDid !== ownerDid) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
        const spaceRow = await actorTxn.space.getSpace(space)
        if (!spaceRow || spaceRow.deletedAt) {
          throw new InvalidRequestError('Space not found', 'SpaceNotFound')
        }
        if (!spaceRow.isOwner) {
          throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
        }

        await actorTxn.space.updateSpaceConfig(space, {
          // Empty string clears managingApp; any other string sets it.
          managingApp:
            managingApp === undefined
              ? undefined
              : managingApp === ''
                ? null
                : managingApp,
          isPublic,
          appAccessMode,
          appExceptions,
        })
      })
    },
  })
}
