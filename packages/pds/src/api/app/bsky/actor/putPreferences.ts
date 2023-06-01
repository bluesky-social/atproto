import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { UserPreference } from '../../../../services/account'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.putPreferences({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const { preferences } = input.body
      const requester = auth.credentials.did
      const { services, db } = ctx
      const checkedPreferences: UserPreference[] = []
      for (const pref of preferences) {
        if (typeof pref.$type === 'string') {
          checkedPreferences.push(pref as UserPreference)
        } else {
          throw new InvalidRequestError('Preference is missing a $type')
        }
      }
      await db.transaction(async (tx) => {
        await services
          .account(tx)
          .putPreferences(requester, checkedPreferences, 'app.bsky')
      })
    },
  })
}
