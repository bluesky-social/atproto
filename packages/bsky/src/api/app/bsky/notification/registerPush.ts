import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Platform } from '../../../../notifications'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { token, platform, serviceDid, appId } = input.body
      const {
        credentials: { did },
      } = auth
      if (serviceDid !== auth.artifacts.aud) {
        throw new InvalidRequestError('Invalid serviceDid.')
      }
      const { notifServer } = ctx
      if (platform !== 'ios' && platform !== 'android' && platform !== 'web') {
        throw new InvalidRequestError(
          'Unsupported platform: must be "ios", "android", or "web".',
        )
      }
      await notifServer.registerDeviceForPushNotifications(
        did,
        token,
        platform as Platform,
        appId,
      )
    },
  })
}
