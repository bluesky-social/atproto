import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getRandomToken } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailUpdate({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const user = await ctx.services.account(ctx.db).getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found')
      }

      const tokenRequired = user.emailConfirmedAt !== null
      if (tokenRequired) {
        const token = getRandomToken().toUpperCase()
        const requestedAt = new Date().toISOString()
        await ctx.db.db
          .insertInto('email_token')
          .values({ purpose: 'update_email', did, token, requestedAt })
          .onConflict((oc) =>
            oc.columns(['purpose', 'did']).doUpdateSet({ token, requestedAt }),
          )
          .execute()
        await ctx.mailer.sendUpdateEmail({ token }, { to: user.email })
      }

      return {
        encoding: 'application/json',
        body: {
          tokenRequired,
        },
      }
    },
  })
}
