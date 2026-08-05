import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner, assertSpaceScope } from '../space/util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.simplespace.removeMember, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, did: memberDid } = input.body

      assertSpaceScope(auth, space, { manage: 'update' })
      assertSpaceOwner(ownerDid, space)

      await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
        await actorTxn.space.getActiveSpace(space)
        await actorTxn.space.removeMember(space, memberDid)
      })
    },
  })
}
