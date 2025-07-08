import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.app.bsky.actor.getPreferences({
    auth: ctx.authVerifier.authorization({
      extraScopes: [AuthScope.Takendown],
      authorize: (permissions) => {
        permissions.assertRpc({
          aud: `${bskyAppView.did}#bsky_appview`,
          lxm: ids.AppBskyActorGetPreferences,
        })
      },
    }),
    handler: async ({ auth }) => {
      const requester = auth.credentials.did

      // @NOTE This is a "hack" that uses a fake lxm to allow for full access
      const fullAccess =
        auth.credentials.type === 'access'
          ? auth.credentials.scope === AuthScope.Access
          : auth.credentials.permissions.allowsRpc({
              aud: `${bskyAppView.did}#bsky_appview`,
              lxm: `${ids.AppBskyActorGetPreferences}Full`,
            })

      const preferences = await ctx.actorStore.read(requester, (store) => {
        return store.pref.getPreferences('app.bsky', { fullAccess })
      })

      return {
        encoding: 'application/json',
        body: { preferences },
      }
    },
  })
}
