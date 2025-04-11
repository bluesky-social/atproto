import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ActiveDeviceSession } from '@atproto/oauth-provider-api'
import { Customization } from '../../customization/customization.js'
import { CspConfig, mergeCsp } from '../../lib/csp/index.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { setupCsrfToken } from '../csrf.js'
import { HydrationData, getAssets } from './assets.js'
import { buildCustomizationCss } from './build-customization-css.js'
import { buildCustomizationData } from './build-customization-data.js'

const ACCOUNT_PAGE_CSP: CspConfig = {
  // API calls are made to the same origin
  'connect-src': ["'self'"],
  // Allow loading of PDS logo & User avatars
  'img-src': ['data:', 'https:'],
  // Prevent embedding in iframes
  'frame-ancestors': ["'none'"],
}

/**
 * @see {@link https://docs.hcaptcha.com/#content-security-policy-settings}
 */
const HCAPTCHA_CSP: CspConfig = {
  'script-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'frame-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'style-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'connect-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
}

export function sendAccountPageFactory(customization: Customization) {
  // Pre-computed options:
  const customizationData = buildCustomizationData(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const { scripts, styles } = getAssets('account-page')
  const csp = mergeCsp(
    ACCOUNT_PAGE_CSP,
    customization?.hcaptcha ? HCAPTCHA_CSP : undefined,
  )
  // Because we are loading avatar images from external sources, that might
  // not have CORP headers set, we need to use at least "credentialless".
  const coep = customization?.hcaptcha
    ? // https://github.com/hCaptcha/react-hcaptcha/issues/259
      // @TODO Remove the use of `unsafeNone` once the issue above is resolved
      CrossOriginEmbedderPolicy.unsafeNone
    : CrossOriginEmbedderPolicy.credentialless

  return async function sendAccountPage(
    req: IncomingMessage,
    res: ServerResponse,
    data: {
      deviceSessions: readonly ActiveDeviceSession[]
    },
  ): Promise<void> {
    await setupCsrfToken(req, res)

    const hydrationScript = declareHydrationData<HydrationData['account-page']>(
      {
        __customizationData: customizationData,
        __deviceSessions: data.deviceSessions,
      },
    )

    return sendWebPage(res, {
      meta: [{ name: 'robots', content: 'noindex' }],
      body: html`<div id="root"></div>`,
      csp,
      coep,
      scripts: [hydrationScript, ...scripts],
      styles: [...styles, customizationCss],
    })
  }
}
