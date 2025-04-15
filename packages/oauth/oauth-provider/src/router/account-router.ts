import type { IncomingMessage, ServerResponse } from 'node:http'
import { ActiveDeviceSession } from '@atproto/oauth-provider-api'
import {
  Router,
  validateFetchDest,
  validateFetchMode,
  validateOrigin,
} from '../lib/http/index.js'
import type { OAuthProvider } from '../oauth-provider.js'
import type { RouterOptions } from './router-options.js'
import { sendAccountPageFactory } from './ui-router/send-account-page.js'

export function accountRouter<
  T extends object | void = void,
  TReq extends IncomingMessage = IncomingMessage,
  TRes extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  options: RouterOptions<TReq, TRes>,
): Router<T, TReq, TRes> {
  const { onError } = options
  const sendAccountPage = sendAccountPageFactory(server.customization)

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin

  const router = new Router<T, TReq, TRes>(issuerUrl)

  router.get<never>(/^\/account(?:\/.*)?$/, async function (req, res, next) {
    try {
      res.setHeader('Referrer-Policy', 'same-origin')

      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      validateFetchMode(req, ['navigate'])
      validateFetchDest(req, ['document'])
      validateOrigin(req, issuerOrigin)

      const { deviceId } = await server.deviceManager.load(req, res)
      const deviceAccounts =
        await server.accountManager.listDeviceAccounts(deviceId)

      return sendAccountPage(req, res, {
        deviceSessions: deviceAccounts.map(
          (deviceAccount): ActiveDeviceSession => ({
            account: deviceAccount.account,
            loginRequired: server.checkLoginRequired(deviceAccount),
          }),
        ),
      })
    } catch (err) {
      onError?.(
        req,
        res,
        err,
        `Failed to handle navigation request to "${req.url}"`,
      )

      next(err)
    }
  })

  return router
}
