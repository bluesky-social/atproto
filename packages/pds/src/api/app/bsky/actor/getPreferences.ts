import { AuthScope, isAccessFull } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { computeProxyTo, pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.app.bsky.actor.getPreferences({
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.Takendown],
      authorize: (permissions, { req }) => {
        const lxm = ids.AppBskyActorGetPreferences
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async ({ auth, req }) => {
      const { did } = auth.credentials

      // If the request has a proxy header different from the bsky app view,
      // we need to proxy the request to the requested app view.
      // @TODO This behavior should not be implemented as part of the XRPC framework
      const lxm = ids.AppBskyActorGetPreferences
      const aud = computeProxyTo(ctx, req, lxm)
      if (aud !== `${bskyAppView.did}#bsky_appview`) {
        return pipethrough(ctx, req, { iss: did, aud, lxm })
      }

      const hasAccessFull =
        auth.credentials.type === 'access' &&
        isAccessFull(auth.credentials.scope)

      const preferences = await ctx.actorStore.read(did, (store) => {
        return store.pref.getPreferences('app.bsky', {
          hasAccessFull,
        })
      })

      return {
        encoding: 'application/json',
        body: { preferences },
      }
    },
  })
}
