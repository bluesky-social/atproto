import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AccountStatus } from '../../../../account-manager'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.deleteAccount({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input }) => {
      const { did } = input.body
      await ctx.actorStore.destroy(did)
      await ctx.accountManager.deleteAccount(did)
      const tombstoneSeq = await ctx.sequencer.sequenceTombstone(did)
      const accountSeq = await ctx.sequencer.sequenceAccountEvt(
        did,
        AccountStatus.Deleted,
      )
      await ctx.sequencer.deleteAllForUser(did, [accountSeq, tombstoneSeq])
    },
  })
}
