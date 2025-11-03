import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getPrivacySettings({
    auth: ctx.authVerifier.authorization({
      authorize: (permissions) => {
        const lxm = ids.AppBskyActorGetPrivacySettings
        permissions.assertRpc({ aud: null as unknown as string, lxm })
      },
    }),
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      let targetDid = requester

      // If actor parameter is provided, resolve it to a DID
      if (params.actor) {
        try {
          const resolved = await ctx.idResolver.did.resolve(params.actor)
          if (!resolved) {
            throw new InvalidRequestError('Actor not found', 'NotFound')
          }
          targetDid = resolved
        } catch (err) {
          throw new InvalidRequestError('Actor not found', 'NotFound')
        }
      }

      // Get privacy settings from preferences
      const privacySettings = await ctx.actorStore.read(
        targetDid,
        async (actorStore) => {
          const prefs = await actorStore.pref.getPreferences(
            'app.bsky',
            {} as any,
          )
          const privacyPref = prefs.find(
            (p) => p.$type === 'app.bsky.actor.privacySettings',
          )
          return privacyPref || { isPrivate: false }
        },
      )

      const isPrivate = (privacySettings as any).isPrivate || false

      // If requesting someone else's settings and they're private, check authorization
      if (targetDid !== requester && isPrivate) {
        // Only the account owner can view their private settings
        throw new AuthRequiredError(
          'Not authorized to view these settings',
          'NotAuthorized',
        )
      }

      return {
        encoding: 'application/json' as const,
        body: {
          isPrivate,
        },
      }
    },
  })
}
