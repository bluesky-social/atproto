import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.deleteAccount({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input }) => {
      const { did } = input.body
      await ctx.actorStore.destroy(did)
      await ctx.accountManager.deleteAccount(did)
      await ctx.sequencer.sequenceTombstone(did)
      await ctx.sequencer.deleteAllForUser(did)
    },
  })
}
