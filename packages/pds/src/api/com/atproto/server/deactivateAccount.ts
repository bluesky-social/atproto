import assert from 'node:assert'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deactivateAccount({
    auth: ctx.authVerifier.accessFull(),
    handler: async ({ auth, input }) => {
      // in the case of entryway, the full flow is deactivateAccount (PDS) -> deactivateAccount (Entryway) -> updateSubjectStatus(PDS)
      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        await ctx.entrywayAgent.com.atproto.server.deactivateAccount(
          input.body,
          await ctx.serviceAuthHeaders(
            auth.credentials.did,
            ctx.cfg.entryway.did,
            ids.ComAtprotoServerDeactivateAccount,
          ),
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
