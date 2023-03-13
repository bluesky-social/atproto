import { AuthRequiredError } from '@atproto/xrpc-server'
import * as repo from '../../../../repo'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.deleteRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { did, collection, rkey } = input.body
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }

      const now = new Date().toISOString()
      const write = await repo.prepareDelete({ did, collection, rkey })
      await ctx.db.transaction(async (dbTxn) => {
        await ctx.services.repo(dbTxn).processWrites(did, [write], now)
      })
    },
  })
}
