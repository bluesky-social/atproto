import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HydrationData as FeHydrationData } from '@atproto/oauth-provider-frontend/hydration-data'
import type { HydrationData as UiHydrationData } from '@atproto/oauth-provider-ui/hydration-data'
import { buildCustomizationCss } from '../../customization/build-customization-css.js'
import { buildCustomizationData } from '../../customization/build-customization-data.js'
import { Customization } from '../../customization/customization.js'
import { CspConfig, mergeCsp } from '../../lib/csp/index.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import { combineMiddlewares } from '../../lib/http/middleware.js'
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
const fe = parseAssetsManifest(
  require.resolve('@atproto/oauth-provider-frontend/bundle-manifest.json'),
)

type HydrationData = Simplify<UiHydrationData & FeHydrationData>

function getAssets(entryName: keyof HydrationData) {
  const assetRef = ui.getAssets(entryName) || fe.getAssets(entryName)
  if (assetRef) return assetRef

  // Fool-proof. Should never happen.
  throw new Error(`Entry "${entryName}" not found in assets`)
}

export const assetsMiddleware = combineMiddlewares([
  ui.assetsMiddleware,
  fe.assetsMiddleware,
])

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
    customization?.hcaptcha ? HCAPTCHA_CSP : undefined,
  )

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
        bodyAttrs: {
          class:
            'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100',
        },
        csp: options?.csp ? mergeCsp(csp, options.csp) : csp,
        coep: options?.coep ?? CrossOriginEmbedderPolicy.credentialless,
        meta: [{ name: 'robots', content: 'noindex' }],
        body: html`<div id="root"></div>`,
        scripts: [script, ...scripts],
        styles: [...styles, customizationCss],
      }),
    )
  }
}
