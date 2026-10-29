import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.deleteSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const ownerDid = auth.credentials.did
      const { space } = body

      assertSpaceOwner(auth, space, { manage: 'delete' })

      const spaceRow = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (spaceRow.deletedAt) return

      const recipients = await ctx.spacePolicyManager.deleteSpace(space)
      ctx.backgroundQueue.add(() =>
        ctx.spaceNotifications.notifySpaceDeleted(space, recipients),
      )
    },
  })
}
