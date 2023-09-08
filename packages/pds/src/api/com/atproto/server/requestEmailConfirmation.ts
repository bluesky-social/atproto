import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getRandomToken } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailConfirmation({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const user = await ctx.services.account(ctx.db).getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found')
      }
      const token = getRandomToken().toUpperCase()
      const requestedAt = new Date().toISOString()
      await ctx.db.db
        .insertInto('email_token')
        .values({ purpose: 'confirm_email', did, token, requestedAt })
        .onConflict((oc) =>
          oc.columns(['purpose', 'did']).doUpdateSet({ token, requestedAt }),
        )
        .execute()
      await ctx.mailer.sendConfirmEmail({ token }, { to: user.email })
    },
  })
}
