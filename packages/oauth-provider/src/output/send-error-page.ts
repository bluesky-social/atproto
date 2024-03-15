import { IncomingMessage, ServerResponse } from 'node:http'

import { cssCode, html } from '@atproto/html'

import { getAsset } from '../assets/index.js'
import {
  Customization,
  buildCustomizationCss,
  buildCustomizationData,
} from './customization.js'
import { buildErrorPayload, buildErrorStatus } from './build-error-payload.js'
import { declareBrowserGlobalVar, sendWebPage } from './send-web-page.js'

export async function sendErrorPage(
  req: IncomingMessage,
  res: ServerResponse,
  err: unknown,
  customization?: Customization,
): Promise<void> {
  return sendWebPage(req, res, {
    status: buildErrorStatus(err),
    scripts: [
      declareBrowserGlobalVar(
        '__customizationData',
        buildCustomizationData(customization),
      ),
      declareBrowserGlobalVar('__errorData', buildErrorPayload(err)),
      await getAsset('main.js'),
    ],
    styles: [
      await getAsset('main.css'),
      cssCode(buildCustomizationCss(customization)),
    ],
    title: 'Error',
    body: html`<div id="root"></div>`,
  })
}
