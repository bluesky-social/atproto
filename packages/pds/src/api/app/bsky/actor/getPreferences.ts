import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthScope } from '../../../../auth-verifier'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getPreferences({
    auth: ctx.authVerifier.access,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      let preferences = await ctx.actorStore.read(requester, (store) =>
        store.pref.getPreferences('app.bsky'),
      )
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
