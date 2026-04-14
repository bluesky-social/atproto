import type { IncomingMessage, ServerResponse } from 'node:http'
import { Customization } from '../../customization/customization.js'
import {
  buildErrorPayload,
  buildErrorStatus,
} from '../../errors/error-parser.js'
import { SendWebAppOptions, sendWebAppFactory } from './assets.js'

export function sendErrorPageFactory(
  customization: Customization,
  options?: SendWebAppOptions,
) {
  const sendApp = sendWebAppFactory('error-page', customization, options)

  return async function sendErrorPage(
    req: IncomingMessage,
    res: ServerResponse,
    err: unknown,
  ): Promise<void> {
    return sendApp(req, res, {
      status: buildErrorStatus(err),
      data: { __errorData: buildErrorPayload(err) },
    })
  }
}
