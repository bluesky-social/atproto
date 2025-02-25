import {
  InvalidRequestError,
  MethodNotImplementedError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AppPlatform } from '../../../../proto/courier_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      if (!ctx.courierClient) {
        throw new MethodNotImplementedError(
          'This service is not configured to support push token registration.',
        )
      }
      const { token, platform, serviceDid, appId } = input.body
      const did = auth.credentials.iss
      if (serviceDid !== auth.credentials.aud) {
        throw new InvalidRequestError('Invalid serviceDid.')
      }
      if (platform !== 'ios' && platform !== 'android' && platform !== 'web') {
        throw new InvalidRequestError(
          'Unsupported platform: must be "ios", "android", or "web".',
        )
      }
      await ctx.courierClient.registerDeviceToken({
        did,
        token,
        platform:
          platform === 'ios'
            ? AppPlatform.IOS
            : platform === 'android'
              ? AppPlatform.ANDROID
              : AppPlatform.WEB,
        appId,
      })
    },
  })
}
