import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.deleteAccount, {
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input }) => {
      const { did } = input.body

      // @NOTE Order matters here: first "unlink" the account by removing it
      // from the account manager database ("source of truth"), then notify the
      // sequencer, and finally cleanup files from the file system.
      await ctx.accountManager.deleteAccount(did)
      try {
        await ctx.sequencer.sequenceAccountDeletion(did)
      } finally {
        await ctx.actorStore.destroy(did)
      }
    },
  })
}
