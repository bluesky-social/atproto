import { InvalidRequestError } from '@atproto/xrpc-server'
import { isAccessFull } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.setPrivacySettings({
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions) => {
        const lxm = ids.AppBskyActorSetPrivacySettings
        permissions.assertRpc({ aud: null as unknown as string, lxm })
      },
    }),
    handler: async ({ auth, input }) => {
      const { did } = auth.credentials
      const { isPrivate } = input.body

      // Validate input
      if (typeof isPrivate !== 'boolean') {
        throw new InvalidRequestError('isPrivate must be a boolean')
      }

      const hasAccessFull =
        auth.credentials.type === 'access' &&
        isAccessFull(auth.credentials.scope)

      // Store privacy settings as a preference
      const privacyPref = {
        $type: 'app.bsky.actor.privacySettings',
        isPrivate,
      }

      // putPreferences will check authorization via prefAllowed internally
      await ctx.actorStore.transact(did, async (actorTxn) => {
        await actorTxn.pref.putPreferences([privacyPref], 'app.bsky', {
          hasAccessFull,
        } as any)
      })

      return {
        encoding: 'application/json' as const,
        body: {
          isPrivate,
        },
      }
    },
  })
}
