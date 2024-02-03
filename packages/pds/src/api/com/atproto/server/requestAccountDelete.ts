import { InvalidRequestError } from '@atproto/xrpc-server'
import { DAY, HOUR } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestAccountDelete({
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
      const user = await ctx.services.account(ctx.db).getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found')
      }
      const token = await ctx.services
        .account(ctx.db)
        .createEmailToken(did, 'delete_account')
      await ctx.mailer.sendAccountDelete({ token }, { to: user.email })
    },
  })
}
