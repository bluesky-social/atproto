import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { Namespaces } from '../../../../stash.js'
import { getNotificationPreferences } from './getPreferences.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.putPreferences, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const { priority } = input.body
      const viewer = auth.credentials.iss
      const currentPreferences = await getNotificationPreferences(ctx, viewer)
      const include = priority ? 'follows' : 'all'
      const preferences = {
        ...currentPreferences,
        reply: { ...currentPreferences.reply, include },
        mention: { ...currentPreferences.mention, include },
        quote: { ...currentPreferences.quote, include },
      }
      await ctx.stashClient.update({
        actorDid: viewer,
        namespace: Namespaces.AppBskyNotificationDefsPreferences,
        key: 'self',
        payload: preferences,
      })
    },
  })
}
