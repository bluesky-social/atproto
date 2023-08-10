import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.registerPushNotification({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { token, platform, endpoint, appId } = params
      const {
        credentials: { did },
      } = auth
      const { notifServer } = ctx

      await notifServer.registerDeviceForPushNotifications(
        did,
        platform,
        token,
        appId,
        endpoint,
      )
    },
  })
}
