import { ServerResponse } from 'node:http'

import { getAsset } from '../assets/index.js'
import { cssCode, html } from '../lib/html/index.js'
import { buildErrorPayload, buildErrorStatus } from './build-error-payload.js'
import {
  Customization,
  buildCustomizationCss,
  buildCustomizationData,
} from './customization.js'
import { declareBackendData, sendWebPage } from './send-web-page.js'

export async function sendErrorPage(
  res: ServerResponse,
  err: unknown,
  customization?: Customization,
): Promise<void> {
  const [jsAsset, cssAsset] = await Promise.all([
    getAsset('main.js'),
    getAsset('main.css'),
  ])

  return sendWebPage(res, {
    status: buildErrorStatus(err),
    scripts: [
      declareBackendData(
        '__customizationData',
        buildCustomizationData(customization),
      ),
      declareBackendData('__errorData', buildErrorPayload(err)),
      jsAsset, // Last (to be able to read the global variables)
    ],
    styles: [
      cssAsset, // First (to be overridden by customization)
      cssCode(buildCustomizationCss(customization)),
    ],
    htmlAttrs: { lang: 'en' },
    title: 'Error',
    body: html`<div id="root"></div>`,
  })
}
