import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AccountPreference } from '../../../../actor-store/preference/reader.js'
import { isAccessFull } from '../../../../auth-scope.js'
import { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import {
  bareDidFromProxyTo,
  computeProxyTo,
  pipethrough,
} from '../../../../pipethrough.js'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.add(app.bsky.actor.putPreferences, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions, { req }) => {
        const lxm = app.bsky.actor.putPreferences.$lxm
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async ({ req, auth, input }) => {
      const { did } = auth.credentials

      // If the request has a proxy header different from the bsky app view,
      // we need to proxy the request to the requested app view.
      // @TODO This behavior should not be implemented as part of the XRPC framework
      const lxm = app.bsky.actor.putPreferences.$lxm
      const aud = computeProxyTo(ctx, req, lxm)
      if (aud !== `${bskyAppView.did}#bsky_appview`) {
        // Phase 1 of service auth updates: outbound JWT keeps bare-DID aud.
        return pipethrough(ctx, req, {
          iss: did,
          aud: bareDidFromProxyTo(aud),
          lxm,
        })
      }

      const checkedPreferences: AccountPreference[] = []
      for (const pref of input.body.preferences) {
        if (typeof pref.$type === 'string') {
          checkedPreferences.push(pref as AccountPreference)
        } else {
          throw new InvalidRequestError('Preference is missing a $type')
        }
      }

      const hasAccessFull =
        auth.credentials.type === 'access' &&
        isAccessFull(auth.credentials.scope)

      await ctx.actorStore.transact(did, async (actorTxn) => {
        await actorTxn.pref.putPreferences(checkedPreferences, 'app.bsky', {
          hasAccessFull,
        })
      })
    },
  })
}
