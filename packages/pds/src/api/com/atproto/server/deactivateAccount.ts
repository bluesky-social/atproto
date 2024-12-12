import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deactivateAccount({
    auth: ctx.authVerifier.accessFull(),
    handler: async ({ req, auth, input }) => {
      // in the case of entryway, the full flow is deactivateAccount (PDS) -> deactivateAccount (Entryway) -> updateSubjectStatus(PDS)
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.deactivateAccount(
          input.body,
          authPassthru(req),
        )
        return
      }

      const requester = auth.credentials.did
      await ctx.accountManager.deactivateAccount(
        requester,
        input.body.deleteAfter ?? null,
      )
      const status = await ctx.accountManager.getAccountStatus(requester)
      await ctx.sequencer.sequenceAccountEvt(requester, status)
    },
  })
}
