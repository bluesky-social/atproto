import assert from 'node:assert'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.revokeAppPassword({
    auth: ctx.authVerifier.accessStandard(),
    handler: async ({ auth, input }) => {
      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        await ctx.entrywayAgent.com.atproto.server.revokeAppPassword(
          input.body,
          await ctx.serviceAuthHeaders(
            auth.credentials.did,
            ctx.cfg.entryway.did,
            ids.ComAtprotoServerRevokeAppPassword,
          ),
        )
        return
      }

      const requester = auth.credentials.did
      const { name } = input.body

      await ctx.accountManager.revokeAppPassword(requester, name)
    },
  })
}
