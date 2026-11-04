import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceAuthority } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.deleteSpace, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const spaceAuthority = auth.credentials.did
      const { space } = body

      assertSpaceAuthority(auth, space, { manage: 'delete' })

      const spaceRow = await ctx.actorStore.read(spaceAuthority, (store) =>
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
