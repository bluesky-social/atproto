import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CustomizationData } from '@atproto/oauth-provider-api'
import type { HydrationData } from '@atproto/oauth-provider-ui/hydration-data'
import { Customization } from '../../customization/customization.js'
import { CspConfig, mergeCsp } from '../../lib/csp/index.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { AuthorizationResultAuthorizePage } from '../../result/authorization-result-authorize-page.js'
import { setupCsrfToken } from '../csrf.js'
import { getAssets } from './assets.js'
import { buildCustomizationCss } from './build-customization-css.js'
import { buildCustomizationData } from './build-customization-data.js'

const AUTHORIZATION_PAGE_CSP: CspConfig = {
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

export function sendAuthorizePageFactory(customization: Customization) {
  // Pre-computed options:
  const customizationData = buildCustomizationData(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const { scripts, styles } = getAssets('authorization-page')
  const csp = mergeCsp(
    AUTHORIZATION_PAGE_CSP,
    customization?.hcaptcha ? HCAPTCHA_CSP : undefined,
  )
  // Because we are loading avatar images from external sources, that might
  // not have CORP headers set, we need to use at least "credentialless".
  const coep = customization?.hcaptcha
    ? // https://github.com/hCaptcha/react-hcaptcha/issues/259
      // @TODO Remove the use of `unsafeNone` once the issue above is resolved
      CrossOriginEmbedderPolicy.unsafeNone
    : CrossOriginEmbedderPolicy.credentialless

  return async function sendAuthorizePage(
    req: IncomingMessage,
    res: ServerResponse,
    data: AuthorizationResultAuthorizePage,
  ): Promise<void> {
    await setupCsrfToken(req, res)

    return sendWebPage(res, {
      meta: [{ name: 'robots', content: 'noindex' }],
      body: html`<div id="root"></div>`,
      csp,
      coep,
      scripts: [buildHydrationData(customizationData, data), ...scripts],
      styles: [...styles, customizationCss],
    })
  }
}

export function buildHydrationData(
  customizationData: CustomizationData,
  data: AuthorizationResultAuthorizePage,
) {
  return declareHydrationData<HydrationData['authorization-page']>({
    __customizationData: customizationData,
    __authorizeData: {
      requestUri: data.uri,

      clientId: data.client.id,
      clientMetadata: data.client.metadata,
      clientTrusted: data.client.info.isTrusted,

      scopeDetails: data.scopeDetails,

      uiLocales: data.parameters.ui_locales,
      loginHint: data.parameters.login_hint,
    },
    __sessions: data.sessions,
  })
}
