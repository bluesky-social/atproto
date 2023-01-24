import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { randomStr } from '@atproto/crypto'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.account.requestDelete({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const token = getSixDigitToken()
      const requestedAt = new Date().toISOString()
      await ctx.db.db
        .insertInto('delete_account_token')
        .values({ did, token, requestedAt })
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({ token, requestedAt }),
        )
        .execute()
      throw new InvalidRequestError('Not implemented')
    },
  })
}

const getSixDigitToken = () => randomStr(4, 'base10').slice(0, 6)
