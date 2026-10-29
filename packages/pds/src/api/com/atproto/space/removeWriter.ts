import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceOwner } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.removeWriter, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const ownerDid = auth.credentials.did
      const { space, did: writerDid } = body

      assertSpaceOwner(auth, space, { manage: 'update' })

      await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
        await actorTxn.space.getActiveSpacePolicy(space)
        await actorTxn.space.removeWriter(space, writerDid)
      })
    },
  })
}
