import type { ServerResponse } from 'node:http'
import { assets } from '@atproto/oauth-provider-ui'
import { CspConfig } from '../lib/csp/index.js'
import { cssCode, html } from '../lib/html/index.js'
import { CrossOriginEmbedderPolicy } from '../lib/http/security-headers.js'
import { AVAILABLE_LOCALES, negotiateLocale } from '../lib/locale.js'
import { buildAssetUrl } from './assets-middleware.js'
import { declareBackendData } from './backend-data.js'
import {
  Customization,
  buildCustomizationCss,
  buildCustomizationData,
} from './build-customization-data.js'
import { buildErrorData } from './build-error-data.js'
import { buildErrorStatus } from './build-error-payload.js'
import { SendPageOptions } from './send-authorize-page.js'
import { sendWebPage } from './send-web-page.js'

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

  return async function sendErrorPage(
    res: ServerResponse,
    err: unknown,
    options?: SendPageOptions,
  ): Promise<void> {
    const locale = negotiateLocale(options?.preferredLocales)

    return sendWebPage(res, {
      status: buildErrorStatus(err),
      meta: [{ name: 'robots', content: 'noindex' }],
      htmlAttrs: { lang: locale },
      body: html`<div id="root"></div>`,
      csp: ERROR_PAGE_CSP,
      coep: CrossOriginEmbedderPolicy.unsafeNone,
      scripts: [
        declareBackendData({
          __availableLocales: AVAILABLE_LOCALES,
          __customizationData: customizationData,
          __errorData: buildErrorData(err),
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
