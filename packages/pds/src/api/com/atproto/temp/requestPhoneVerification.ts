import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { HOUR, MINUTE } from '@atproto/common'
import { countAll } from '../../../../db/util'

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
      if (!ctx.twilio || !ctx.cfg.phoneVerification.required) {
        throw new InvalidRequestError('phone verification not enabled')
      }
      const accountsPerPhoneNumber =
        ctx.cfg.phoneVerification.accountsPerPhoneNumber
      const { phoneNumber } = input.body

      const res = await ctx.db.db
        .selectFrom('phone_verification')
        .select(countAll.as('count'))
        .where('phoneNumber', '=', phoneNumber)
        .executeTakeFirst()
      if (res && res.count >= accountsPerPhoneNumber) {
        throw new InvalidRequestError(
          `There are too many accounts currently using this phone number. Max: ${accountsPerPhoneNumber}`,
        )
      }

      await ctx.twilio.sendCode(phoneNumber)
    },
  })
}
