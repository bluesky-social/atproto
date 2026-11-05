import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Customization } from '../../customization/customization.js'
import {
  buildErrorPayload,
  buildErrorStatus,
} from '../../errors/error-parser.js'
import { type SendWebAppOptions, sendWebAppFactory } from './assets.js'

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
    const status = buildErrorStatus(err)
    return sendApp(req, res, {
      status,
      data: { __errorStatus: status, __errorData: buildErrorPayload(err) },
    })
  }
}
