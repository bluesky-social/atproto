import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildCustomizationCss } from '../../customization/build-customization-css.js'
import { buildCustomizationData } from '../../customization/build-customization-data.js'
import { Customization } from '../../customization/customization.js'
import {
  buildErrorPayload,
  buildErrorStatus,
} from '../../errors/error-parser.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode } from '../../lib/html/index.js'
import { html } from '../../lib/html/tags.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { HydrationData, SPA_CSP, getAssets } from './assets.js'

export function sendErrorPageFactory(customization: Customization) {
  // Pre-computed options:
  const customizationData = buildCustomizationData(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const { scripts, styles } = getAssets('error-page')

  return function sendErrorPage(
    req: IncomingMessage,
    res: ServerResponse,
    err: unknown,
  ): void {
    const script = declareHydrationData<HydrationData['error-page']>({
      __customizationData: customizationData,
      __errorData: buildErrorPayload(err),
    })

    return sendWebPage(res, {
      status: buildErrorStatus(err),
      meta: [{ name: 'robots', content: 'noindex' }],
      body: html`<div id="root"></div>`,
      csp: SPA_CSP,
      coep: CrossOriginEmbedderPolicy.credentialless,
      scripts: [script, ...scripts],
      styles: [...styles, customizationCss],
    })
  }
}
