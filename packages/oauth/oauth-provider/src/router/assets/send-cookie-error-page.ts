import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Customization } from '../../customization/customization.js'
import { type SendWebAppOptions, sendWebAppFactory } from './assets.js'

export function sendCookieErrorPageFactory(
  customization: Customization,
  options?: SendWebAppOptions,
) {
  const sendApp = sendWebAppFactory('cookie-error-page', customization, options)

  return async function sendCookieErrorPage(
    req: IncomingMessage,
    res: ServerResponse,
    data: { continueUrl: URL },
  ) {
    return sendApp(req, res, {
      status: 400,
      data: { __continueUrl: data.continueUrl.toString() },
    })
  }
}
