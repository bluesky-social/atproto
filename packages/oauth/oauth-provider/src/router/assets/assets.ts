import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HydrationData as UiHydrationData } from '@atproto/oauth-provider-ui/hydration-data'
import { buildCustomizationCss } from '../../customization/build-customization-css.js'
import { buildCustomizationData } from '../../customization/build-customization-data.js'
import { Customization } from '../../customization/customization.js'
import { CspConfig, mergeCsp } from '../../lib/csp/index.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import { WriteResponseOptions } from '../../lib/http/response.js'
import {
  CrossOriginEmbedderPolicy,
  SecurityHeadersOptions,
} from '../../lib/http/security-headers.js'
import { mergeDefaults } from '../../lib/util/object.js'
import { Simplify } from '../../lib/util/type.js'
import { WriteHtmlOptions, writeHtml } from '../../lib/write-html.js'
import { parseAssetsManifest } from './assets-manifest.js'
import { setupCsrfToken } from './csrf.js'

// If the "ui" and "frontend" packages are ever unified, this can be replaced
// with a single expression:
//
// const { getAssets, assetsMiddleware } = parseAssetsManifest(
//   require.resolve('@atproto/oauth-provider-ui/bundle-manifest.json'),
// )

const ui = parseAssetsManifest(
  require.resolve('@atproto/oauth-provider-ui/bundle-manifest.json'),
)

type HydrationData = Simplify<UiHydrationData>

function getAssets(entryName: keyof HydrationData) {
  const assetRef = ui.getAssets(entryName)
  if (assetRef) return assetRef

  // Fool-proof. Should never happen.
  throw new Error(`Entry "${entryName}" not found in assets`)
}

export const assetsMiddleware = ui.assetsMiddleware

const SPA_CSP: CspConfig = {
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

export type SendWebAppOptions = SecurityHeadersOptions & WriteResponseOptions

export function sendWebAppFactory<P extends keyof HydrationData>(
  page: P,
  customization: Customization,
  defaults: SendWebAppOptions = {},
) {
  // Pre-computed options:
  const customizationData = buildCustomizationData(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const { scripts, styles } = getAssets(page)

  const csp = mergeCsp(
    SPA_CSP,
    customization.hcaptcha ? HCAPTCHA_CSP : undefined,
  )

  const coep = customization.hcaptcha
    ? // hCaptcha's implementation of COEP is currently broken. Let's disable it
      // to avoid breaking the entire page.
      //
      // https://github.com/hCaptcha/react-hcaptcha/issues/259
      // https://github.com/hCaptcha/react-hcaptcha/issues/380
      CrossOriginEmbedderPolicy.unsafeNone
    : // Since we are loading avatars form other origins, which might not have
      // CORP headers, we need to use the "credentialless" value, which allows
      // loading cross-origin resources without credentials (cookies, client
      // certificates, etc.). This is a more secure alternative to
      // "unsafe-none". Ideally, we would want to set COEP to "require-corp" and
      // ensure that all cross-origin resources have the appropriate CORP
      // headers.
      CrossOriginEmbedderPolicy.credentialless

  return async function sendWebApp(
    req: IncomingMessage,
    res: ServerResponse,
    options: SendWebAppOptions & {
      data: Omit<HydrationData[P], '__customizationData'>
    },
  ): Promise<void> {
    await setupCsrfToken(req, res)

    const script = declareHydrationData({
      ...options.data,
      __customizationData: customizationData,
    })

    return writeHtml(
      res,
      mergeDefaults<WriteHtmlOptions>(defaults, options, {
        bodyAttrs: { class: 'text-text-default bg-contrast-0' },
        csp: options?.csp ? mergeCsp(csp, options.csp) : csp,
        coep: options?.coep ?? coep,
        meta: [{ name: 'robots', content: 'noindex' }],
        body: html`<div id="root"></div>`,
        scripts: [script, ...scripts],
        styles: [...styles, customizationCss],
      }),
    )
  }
}
