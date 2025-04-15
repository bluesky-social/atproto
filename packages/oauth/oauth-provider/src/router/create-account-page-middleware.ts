import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ActiveDeviceSession } from '@atproto/oauth-provider-api'
import {
  Middleware,
  Router,
  validateFetchDest,
  validateFetchMode,
  validateOrigin,
} from '../lib/http/index.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { sendAccountPageFactory } from './assets/send-account-page.js'
import { sendErrorPageFactory } from './assets/send-error-page.js'
import type { MiddlewareOptions } from './middleware-options.js'

export function createAccountPageMiddleware<
  T extends object | void = void,
  TReq extends IncomingMessage = IncomingMessage,
  TRes extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  { onError }: MiddlewareOptions<TReq, TRes>,
): Middleware<T, TReq, TRes> {
  const sendAccountPage = sendAccountPageFactory(server.customization)
  const sendErrorPage = sendErrorPageFactory(server.customization)

  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin

  const router = new Router<T, TReq, TRes>(issuerUrl)

  router.get<never>(/^\/account(?:\/.*)?$/, async function (req, res) {
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

      sendAccountPage(req, res, {
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

      if (!res.headersSent) {
        sendErrorPage(req, res, err)
      }
    }
  })

  return router.buildMiddleware()
}
