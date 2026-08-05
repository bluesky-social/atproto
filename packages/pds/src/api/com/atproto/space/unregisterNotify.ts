import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertCredentialSpace, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.unregisterNotify, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ input, auth }) => {
      const { space, service } = input.body

      assertCredentialSpace(auth.credentials, space)

      const { spaceDid } = toSpaceRef(space)

      const spaceRow = await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow || spaceRow.deletedAt) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }

      // Not resolved here: a subscriber whose DID document has since changed must
      // still be able to withdraw. Succeeds when nothing was registered.
      await ctx.actorStore.transact(spaceDid, (actorTxn) =>
        actorTxn.space.removeCredentialRecipient(space, service),
      )
    },
  })
}
