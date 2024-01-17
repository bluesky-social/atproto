import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { HOUR, MINUTE } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.requestPhoneVerification({
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 50,
      },
      {
        durationMs: HOUR,
        points: 100,
      },
    ],
    handler: async ({ input }) => {
      if (!ctx.twilio) {
        throw new InvalidRequestError('phone verification not enabled')
      }
      await ctx.twilio.sendCode(input.body.phoneNumber)
    },
  })
}
