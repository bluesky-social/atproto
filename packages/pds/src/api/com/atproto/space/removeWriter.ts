import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceAuthority } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.removeWriter, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      checkDeactivated: true,
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input: { body }, auth }) => {
      const authorityDid = auth.credentials.did
      const { space, repo } = body

      assertSpaceAuthority(auth, space, { manage: 'update' })

      await ctx.actorStore.transact(authorityDid, async (actorTxn) => {
        await actorTxn.space.getActiveSpacePolicy(space)
        await actorTxn.space.removeWriter(space, repo)
      })
    },
  })
}
