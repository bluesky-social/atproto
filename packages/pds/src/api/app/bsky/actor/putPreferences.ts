import { InvalidRequestError } from '@atproto/xrpc-server'
import { AccountPreference } from '../../../../actor-store/preference/reader'
import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx
  if (!bskyAppView) return

  server.app.bsky.actor.putPreferences({
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions) => {
        permissions.assertRpc({
          aud: `${bskyAppView.did}#bsky_appview`,
          lxm: ids.AppBskyActorPutPreferences,
        })
      },
    }),
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

      // @NOTE This is a "hack" that uses a fake lxm to allow for full access
      const fullAccess =
        auth.credentials.type === 'access'
          ? auth.credentials.scope === AuthScope.Access
          : auth.credentials.permissions.allowsRpc({
              aud: `${bskyAppView.did}#bsky_appview`,
              lxm: `${ids.AppBskyActorPutPreferences}Full`,
            })

      await ctx.actorStore.transact(requester, async (actorTxn) => {
        await actorTxn.pref.putPreferences(checkedPreferences, 'app.bsky', {
          fullAccess,
        })
      })
    },
  })
}
