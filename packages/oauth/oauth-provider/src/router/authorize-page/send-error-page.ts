import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  AvailableLocales,
  CustomizationData,
  ErrorData,
} from '@atproto/oauth-provider-api'
import { AVAILABLE_LOCALES, assets } from '@atproto/oauth-provider-ui'
import { Customization } from '../../customization/customization.js'
import {
  buildErrorPayload,
  buildErrorStatus,
} from '../../errors/error-parser.js'
import { CspConfig } from '../../lib/csp/index.js'
import { declareBackendData } from '../../lib/html/backend-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import { extractLocales } from '../../lib/http/request.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { buildAssetUrl } from './assets-middleware.js'
import { buildCustomizationCss } from './build-customization-css.js'
import { buildCustomizationData } from './build-customization-data.js'
import { negotiateLocale } from './negotiate-locale.js'

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
  const scripts = Array.from(assets)
    .filter(
      ([, item]) =>
        item.type === 'chunk' && item.isEntry && item.name === 'error-page',
    )
    .map(([filename]) => ({ url: buildAssetUrl(filename) }))
  const styles = Array.from(assets)
    .filter(([, item]) => item.mime === 'text/css')
    .map(([filename]) => ({ url: buildAssetUrl(filename) }))

  return function sendErrorPage(
    req: IncomingMessage,
    res: ServerResponse,
    err: unknown,
  ): void {
    const locale = negotiateLocale(extractLocales(req))

    return sendWebPage(res, {
      status: buildErrorStatus(err),
      meta: [{ name: 'robots', content: 'noindex' }],
      htmlAttrs: { lang: locale },
      body: html`<div id="root"></div>`,
      csp: ERROR_PAGE_CSP,
      coep: CrossOriginEmbedderPolicy.unsafeNone,
      scripts: [
        declareBackendData<{
          // Matches the variables in "error-page.tsx"
          __availableLocales: AvailableLocales
          __customizationData: CustomizationData
          __errorData: ErrorData
        }>({
          __availableLocales: AVAILABLE_LOCALES,
          __customizationData: customizationData,
          __errorData: buildErrorPayload(err),
        }),
        // After data
        ...scripts,
      ],
      styles: [
        ...styles,
        // After styles
        customizationCss,
      ],
    })
  }
}
