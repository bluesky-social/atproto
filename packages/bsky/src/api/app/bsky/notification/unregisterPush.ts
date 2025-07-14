import {
  InvalidRequestError,
  MethodNotImplementedError,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertLexPlatform, lexPlatformToProtoPlatform } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.unregisterPush({
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
      try {
        assertLexPlatform(platform)
      } catch (err) {
        throw new InvalidRequestError(
          'Unsupported platform: must be "ios", "android", or "web".',
        )
      }
      await ctx.courierClient.unregisterDeviceToken({
        did,
        token,
        platform: lexPlatformToProtoPlatform(platform),
        appId,
      })
    },
  })
}
