import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthScope } from '../../../../auth-verifier'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.cfg.bskyAppView) return
  server.app.bsky.actor.getPreferences({
    auth: ctx.authVerifier.accessStandard({
      additional: [AuthScope.Takendown],
    }),
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const preferences = await ctx.actorStore.read(requester, (store) =>
        store.pref.getPreferences('app.bsky', auth.credentials.scope),
      )
      return {
        encoding: 'application/json',
        body: { preferences },
      }
    },
  })
}
