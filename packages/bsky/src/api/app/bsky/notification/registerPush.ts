import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Platform } from '../../../../notifications'
import { CourierClient } from '../../../../courier'
import { AppPlatform } from '../../../../proto/courier_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.registerPush({
    auth: ctx.authVerifier.standard,
    handler: async ({ req, auth, input }) => {
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

      const db = ctx.db.getPrimary()

      const registerDeviceWithAppview = async () => {
        await ctx.services
          .actor(db)
          .registerPushDeviceToken(did, token, platform as Platform, appId)
      }

      const registerDeviceWithCourier = async (
        courierClient: CourierClient,
      ) => {
        await courierClient.registerDeviceToken({
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
      }

      if (ctx.cfg.courierOnlyRegistration) {
        assert(ctx.courierClient)
        await registerDeviceWithCourier(ctx.courierClient)
      } else {
        await registerDeviceWithAppview()
        if (ctx.courierClient) {
          try {
            await registerDeviceWithCourier(ctx.courierClient)
          } catch (err) {
            req.log.warn(err, 'failed to register device token with courier')
          }
        }
      }
    },
  })
}
