import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ActiveDeviceSession } from '@atproto/oauth-provider-api'
import { Customization } from '../../customization/customization.js'
import { SendWebAppOptions, sendWebAppFactory } from './assets.js'

export function sendAccountPageFactory(
  customization: Customization,
  options?: SendWebAppOptions,
) {
  const sendApp = sendWebAppFactory('account-page', customization, options)

  return async function sendAccountPage(
    req: IncomingMessage,
    res: ServerResponse,
    data: {
      deviceSessions: readonly ActiveDeviceSession[]
    },
  ): Promise<void> {
    return sendApp(req, res, {
      data: { __deviceSessions: data.deviceSessions },
    })
  }
}
