import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.putPreferences({
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
