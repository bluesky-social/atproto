import { InvalidRequestError } from '@atproto/xrpc-server'
import { DAY, HOUR } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailConfirmation({
    rateLimit: [
      {
        durationMs: DAY,
        points: 15,
        calcKey: ({ auth }) => auth.credentials.did,
      },
      {
        durationMs: HOUR,
        points: 5,
        calcKey: ({ auth }) => auth.credentials.did,
      },
    ],
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const { token, email } = await ctx.db.transaction(async (dbTxn) => {
        const token = await ctx.services
          .account(dbTxn)
          .createEmailToken(did, 'confirm_email')
        const user = await ctx.services.account(ctx.db).getAccount(did)
        if (!user) {
          throw new InvalidRequestError('user not found')
        }
        return { token, email: user.email }
      })
      await ctx.mailer.sendConfirmEmail({ token }, { to: email })
    },
  })
}
