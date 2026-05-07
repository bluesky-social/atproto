import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.notification.putPreferences, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const { priority } = input.body
      const viewer = auth.credentials.iss
      await ctx.bsyncClient.addNotifOperation({
        actorDid: viewer,
        priority,
      })
    },
  })
}
