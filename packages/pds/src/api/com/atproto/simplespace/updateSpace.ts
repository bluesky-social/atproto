import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from '../space/util.js'
import { fromLexAppAccess } from './config.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.updateSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, policy, managingApp, appAccess } = input.body

      assertSpaceScope(auth, space, { manage: 'update' })

      const { spaceDid } = new AtUri(space).asSpaceUri()
      if (spaceDid !== ownerDid) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      const appAccessPatch = appAccess ? fromLexAppAccess(appAccess) : {}

      await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
        const spaceRow = await actorTxn.space.getSpace(space)
        if (!spaceRow || spaceRow.deletedAt) {
          throw new InvalidRequestError('Space not found', 'SpaceNotFound')
        }
        if (!spaceRow.isOwner) {
          throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
        }

        await actorTxn.space.updateSpaceConfig(space, {
          policy,
          // Empty string clears managingApp; any other string sets it.
          managingApp:
            managingApp === undefined
              ? undefined
              : managingApp === ''
                ? null
                : managingApp,
          ...appAccessPatch,
        })
      })
    },
  })
}
