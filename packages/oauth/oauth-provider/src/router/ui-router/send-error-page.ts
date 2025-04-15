import type { IncomingMessage, ServerResponse } from 'node:http'
import { CustomizationData } from '@atproto/oauth-provider-api'
import { HydrationData } from '@atproto/oauth-provider-ui/hydration-data'
import { Customization } from '../../customization/customization.js'
import {
  buildErrorPayload,
  buildErrorStatus,
} from '../../errors/error-parser.js'
import { CspConfig } from '../../lib/csp/index.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { getAssets } from '../assets.js'
import { buildCustomizationCss } from './build-customization-css.js'
import { buildCustomizationData } from './build-customization-data.js'

const ERROR_PAGE_CSP: CspConfig = {
  // Allow loading of PDS logo
  'img-src': ['data:', 'https:'],
  // Prevent embedding in iframes
  'frame-ancestors': ["'none'"],
}

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
    return sendWebPage(res, {
      status: buildErrorStatus(err),
      meta: [{ name: 'robots', content: 'noindex' }],
      body: html`<div id="root"></div>`,
      csp: ERROR_PAGE_CSP,
      coep: CrossOriginEmbedderPolicy.unsafeNone,
      scripts: [buildHydrationData(customizationData, err), ...scripts],
      styles: [...styles, customizationCss],
    })
  }
}

export function buildHydrationData(
  customizationData: CustomizationData,
  err: unknown,
) {
  return declareHydrationData<HydrationData['error-page']>({
    __customizationData: customizationData,
    __errorData: buildErrorPayload(err),
  })
}
