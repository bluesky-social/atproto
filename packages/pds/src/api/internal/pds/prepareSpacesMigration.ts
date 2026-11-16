import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { internal } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(internal.pds.prepareSpacesMigration, {
    auth: ctx.authVerifier.adminTokenOrEntrywayService,
    handler: async ({ input }) => {
      const { did } = input.body
      // Opening the store migrates it. Throws NotFound if there is none.
      await ctx.actorStore.read(did, () => {})
      const kemKey = await ctx.actorStore.ensureKemKeypair(did)
      return {
        encoding: 'application/json' as const,
        body: { kemKey: kemKey.did() },
      }
    },
  })
}
