import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.deleteAccount, {
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input }) => {
      const { did } = input.body

      // @NOTE Order matters here and is the reverse order of account creation.
      // Putting the sequencer first allows for proper restoration of the
      // account's state in case of outage recovery. We then "unlink" the
      // account and finally remove the files from the file system.
      await ctx.sequencer.deleteAccount(did)
      await ctx.accountManager.deleteAccount(did)
      await ctx.actorStore.destroy(did)
    },
  })
}
