import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner, assertSpaceScope } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.addMember, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, did: memberDid } = input.body

      // Membership management is a space-level "manage" (update) operation.
      assertSpaceScope(auth, space, { manage: 'update' })
      assertSpaceOwner(ownerDid, space)

      // The member isn't notified: their PDS materializes its repo on first write.
      await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
        await actorTxn.space.getActiveSpace(space)
        await actorTxn.space.addMember(space, memberDid)
      })
    },
  })
}
