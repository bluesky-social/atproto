import disposable from 'disposable-email'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.checkSignupAvailability({
    handler: async ({ params }) => {
      const email = params.email.toLowerCase()
      if (!disposable.validate(email)) {
        throw new InvalidRequestError(
          'This email address is not supported, please use a different email.',
        )
      }

      const alreadyExists = await ctx.db.db
        .selectFrom('user_account')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst()
      if (alreadyExists) {
        throw new InvalidRequestError(`Email already taken: ${email}`)
      }

      await ctx.db.db
        .insertInto('queued_email')
        .values({
          email,
          registeredAt: new Date().toISOString(),
        })
        .onConflict((oc) => oc.doNothing())
        .execute()

      const hasAvailability = ctx.signupLimiter.hasAvailability()

      return {
        encoding: 'application/json',
        body: {
          hasAvailability,
        },
      }
    },
  })
}
