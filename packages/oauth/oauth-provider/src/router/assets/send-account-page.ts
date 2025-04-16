import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ActiveDeviceSession } from '@atproto/oauth-provider-api'
import { buildCustomizationCss } from '../../customization/build-customization-css.js'
import { buildCustomizationData } from '../../customization/build-customization-data.js'
import { Customization } from '../../customization/customization.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode } from '../../lib/html/index.js'
import { html } from '../../lib/html/tags.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { HydrationData, SPA_CSP, getAssets } from './assets.js'
import { setupCsrfToken } from './csrf.js'

export function sendAccountPageFactory(customization: Customization) {
  // Pre-computed options:
  const customizationData = buildCustomizationData(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const { scripts, styles } = getAssets('account-page')

  return async function sendAccountPage(
    req: IncomingMessage,
    res: ServerResponse,
    data: {
      deviceSessions: readonly ActiveDeviceSession[]
    },
  ): Promise<void> {
    await setupCsrfToken(req, res)

    const script = declareHydrationData<HydrationData['account-page']>({
      __customizationData: customizationData,
      __deviceSessions: data.deviceSessions,
    })

    return sendWebPage(res, {
      meta: [{ name: 'robots', content: 'noindex' }],
      body: html`<div id="root"></div>`,
      csp: SPA_CSP,
      coep: CrossOriginEmbedderPolicy.credentialless,
      scripts: [script, ...scripts],
      styles: [...styles, customizationCss],
    })
  }
}
