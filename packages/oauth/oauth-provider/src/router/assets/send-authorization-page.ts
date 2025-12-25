import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildCustomizationCss } from '../../customization/build-customization-css.js'
import { buildCustomizationData } from '../../customization/build-customization-data.js'
import { Customization } from '../../customization/customization.js'
import { mergeCsp } from '../../lib/csp/index.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { AuthorizationResultAuthorizePage } from '../../result/authorization-result-authorize-page.js'
import { HCAPTCHA_CSP, HydrationData, SPA_CSP, getAssets } from './assets.js'
import { setupCsrfToken } from './csrf.js'

export function sendAuthorizePageFactory(customization: Customization) {
  // Pre-computed options:
  const customizationData = buildCustomizationData(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const { scripts, styles } = getAssets('authorization-page')
  const csp = mergeCsp(
    SPA_CSP,
    customization?.hcaptcha ? HCAPTCHA_CSP : undefined,
  )
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

    const script = declareHydrationData<HydrationData['authorization-page']>({
      __customizationData: customizationData,
      __authorizeData: {
        requestUri: data.requestUri,

        clientId: data.client.id,
        clientMetadata: data.client.metadata,
        clientTrusted: data.client.info.isTrusted,
        clientFirstParty: data.client.info.isFirstParty,

        scope: data.parameters.scope,
        uiLocales: data.parameters.ui_locales,
        loginHint: data.parameters.login_hint,
        promptMode: data.parameters.prompt,
        permissionSets: Object.fromEntries(data.permissionSets),
      },
      __sessions: data.sessions,
    })

    return sendWebPage(res, {
      meta: [{ name: 'robots', content: 'noindex' }],
      body: html`<div id="root"></div>`,
      bodyAttrs: {
        class: 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100',
      },
      csp,
      coep,
      scripts: [script, ...scripts],
      styles: [...styles, customizationCss],
    })
  }
}
