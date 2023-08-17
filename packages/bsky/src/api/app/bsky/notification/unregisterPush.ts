import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.unregisterPush({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { token, serviceDid } = params
      const {
        credentials: { did },
      } = auth
      if (serviceDid !== auth.artifacts.aud) {
        throw new InvalidRequestError('Invalid serviceDid.')
      }
      const { notifServer } = ctx
      await notifServer.unregisterDeviceForPushNotifications(did, token)
    },
  })
}
