import type { DidString } from '@atproto/lex'
import { asDidString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import { AuthScope, isAccessFull } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import {
  bareDidFromProxyTo,
  computeProxyTo,
  pipethrough,
} from '../../../../pipethrough.js'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.add(app.bsky.actor.getPreferences, {
    auth: ctx.authVerifier.authorizationOrModerator({
      additional: [AuthScope.Takendown],
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.actor.getPreferences.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async ({ auth, req, params }) => {
      const did: DidString =
        auth.credentials.type === 'mod_service' ||
        auth.credentials.type === 'admin_token'
          ? asDidString((params as Record<string, unknown>).did)
          : auth.credentials.did

      const isModerator =
        auth.credentials.type === 'mod_service' ||
        auth.credentials.type === 'admin_token'

      // If the request has a proxy header different from the bsky app view,
      // we need to proxy the request to the requested app view.
      // @TODO This behavior should not be implemented as part of the XRPC framework
      const lxm = app.bsky.actor.getPreferences.$lxm
      const aud = computeProxyTo(ctx, req, lxm)
      if (aud !== `${bskyAppView.did}#bsky_appview`) {
        // Phase 1 of service auth updates: outbound JWT keeps bare-DID aud.
        return pipethrough(ctx, req, {
          iss: did,
          aud: bareDidFromProxyTo(aud),
          lxm,
        })
      }

      const hasAccessFull =
        isModerator ||
        (auth.credentials.type === 'access' &&
          isAccessFull(auth.credentials.scope))

      const preferences = await ctx.actorStore.read(did, (store) => {
        return store.pref.getPreferences('app.bsky', { hasAccessFull })
      })

      return {
        encoding: 'application/json' as const,
        body: { preferences },
      }
    },
  })
}
