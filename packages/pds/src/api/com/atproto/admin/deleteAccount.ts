import { AccountStatus } from '../../../../account-manager/account-manager'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.deleteAccount({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input }) => {
      const { did } = input.body
      await ctx.actorStore.destroy(did)
      await ctx.accountManager.deleteAccount(did)
      const accountSeq = await ctx.sequencer.sequenceAccountEvt(
        did,
        AccountStatus.Deleted,
      )
      await ctx.sequencer.deleteAllForUser(did, [accountSeq])
    },
  })
}
