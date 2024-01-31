import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { countAll } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.checkSignupQueue({
    auth: ctx.authVerifier.accessDeactived,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const account = await ctx.db.db
        .selectFrom('user_account')
        .selectAll()
        .where('did', '=', requester)
        .executeTakeFirstOrThrow()
      const activated = !!account.activatedAt

      let placeInQueue: number | undefined
      if (!activated) {
        const res = await ctx.db.db
          .selectFrom('user_account')
          .select(countAll.as('count'))
          .where('user_account.activatedAt', 'is', null)
          .where('user_account.createdAt', '<', account.createdAt)
          .executeTakeFirst()
        placeInQueue = res?.count
      }

      const limiter = ctx.signupLimiter
      let estimatedTimeMs: number | undefined
      if (placeInQueue && !limiter.flags.disableSignups) {
        const accountsInPeriod = await limiter.accountsInPeriod()
        if (accountsInPeriod > 0) {
          estimatedTimeMs = Math.ceil(
            (placeInQueue * limiter.flags.periodMs) / accountsInPeriod,
          )
        }
      }

      return {
        encoding: 'application/json',
        body: {
          activated,
          placeInQueue,
          estimatedTimeMs,
        },
      }
    },
  })
}
