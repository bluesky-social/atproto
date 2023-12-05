import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthScope } from '../../../../auth-verifier'
import { authPassthru, proxy, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getPreferences({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, req }) => {
      const proxied = await proxy(
        ctx,
        auth.credentials.audience,
        async (agent) => {
          const result = await agent.api.app.bsky.actor.getPreferences(
            undefined,
            authPassthru(req),
          )
          return resultPassthru(result)
        },
      )
      if (proxied !== null) {
        return proxied
      }

      const requester = auth.credentials.did
      const { services, db } = ctx
      let preferences = await services
        .account(db)
        .getPreferences(requester, 'app.bsky')
      if (auth.credentials.scope !== AuthScope.Access) {
        // filter out personal details for app passwords
        preferences = preferences.filter(
          (pref) => pref.$type !== 'app.bsky.actor.defs#personalDetailsPref',
        )
      }
      return {
        encoding: 'application/json',
        body: { preferences },
      }
    },
  })
}
