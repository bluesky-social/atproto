import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceAuthority, toSpaceRef } from './util.js'

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
      const authorityDid = auth.credentials.did
      const { space } = body
      const ref = toSpaceRef(space)

      assertSpaceAuthority(auth, ref, { manage: 'delete' })

      const spaceRow = await ctx.actorStore.read(authorityDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (spaceRow.deletedAt) return

      const registrations = await ctx.spacePolicyManager.deleteSpace(ref)
      ctx.backgroundQueue.add(() =>
        ctx.spaceNotifications.notifySyncers(
          ref,
          registrations,
          com.atproto.space.notifySpaceUpdate.spaceDeleted.$build({}),
        ),
      )
    },
  })
}
