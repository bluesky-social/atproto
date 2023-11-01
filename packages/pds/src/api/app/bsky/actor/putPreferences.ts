import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { UserPreference } from '../../../../services/account'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { authPassthru, proxy } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.putPreferences({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, input, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          await agent.api.app.bsky.actor.putPreferences(
            input.body,
            authPassthru(req, true),
          )
        },
      )
      if (proxied !== null) {
        return proxied
      }

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
