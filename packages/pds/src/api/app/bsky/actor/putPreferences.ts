import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AccountPreference } from '../../../../actor-store/preference/reader'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.putPreferences({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, input }) => {
      const { preferences } = input.body
      const requester = auth.credentials.did
      const checkedPreferences: AccountPreference[] = []
      for (const pref of preferences) {
        if (typeof pref.$type === 'string') {
          checkedPreferences.push(pref as AccountPreference)
        } else {
          throw new InvalidRequestError('Preference is missing a $type')
        }
      }
      await ctx.actorStore.transact(requester, async (actorTxn) => {
        await actorTxn.pref.putPreferences(checkedPreferences, 'app.bsky')
      })
    },
  })
}
