import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import type { HydrationData as UiHydrationData } from '@atproto/oauth-provider-ui/hydration-data'
import { buildCustomizationCoep } from '../../customization/build-customization-coep.js'
import { buildCustomizationCsp } from '../../customization/build-customization-csp.js'
import { buildCustomizationCss } from '../../customization/build-customization-css.js'
import { buildCustomizationData } from '../../customization/build-customization-data.js'
import type { Customization } from '../../customization/customization.js'
import { type CspConfig, mergeCsp } from '../../lib/csp/index.js'
import { declareHydrationData } from '../../lib/html/hydration-data.js'
import { cssCode, html } from '../../lib/html/index.js'
import type { WriteResponseOptions } from '../../lib/http/response.js'
import {
  CrossOriginEmbedderPolicy,
  type SecurityHeadersOptions,
} from '../../lib/http/security-headers.js'
import { mergeDefaults } from '../../lib/util/object.js'
import type { Simplify } from '../../lib/util/type.js'
import { type WriteHtmlOptions, writeHtml } from '../../lib/write-html.js'
import { parseAssetsManifest } from './assets-manifest.js'
import { setupCsrfToken } from './csrf.js'

const require = createRequire(import.meta.url)

export const { getAssets, assetsMiddleware } = parseAssetsManifest(
  require.resolve('@atproto/oauth-provider-ui/bundle-manifest.json'),
)

type HydrationData = Simplify<UiHydrationData>

const SPA_CSP: CspConfig = {
  // API calls are made to the same origin
  'connect-src': ["'self'"],
  // Prevent embedding in iframes
  'frame-ancestors': ["'none'"],
}

// Allow loading of avatars and (trusted) OAuth client images
const AVATAR_CSP: CspConfig = {
  // @TODO Find a way to make this narrower (e.g. by proxying avatars through
  // our own domain and using "'self'" here, or by using the customization data
  // to allow-list specific origins), or by only allowing "data:" uris. Note
  // that the current https: value also prevents avatars and client images from
  // working in dev (which we also may want to find a solution to).
  'img-src': ['https:'],
}

export type SendWebAppOptions = SecurityHeadersOptions & WriteResponseOptions

/**
 * Pre-computes page rendering assets and data and returns a function that can
 * be used to send the @atproto/oauth-provider-ui web app {@link page} specified
 * by the {@link P} type parameter.
 */
export function sendWebAppFactory<P extends keyof HydrationData>(
  page: P,
  customization: Customization,
  defaults: SendWebAppOptions = {},
) {
  const assets = getAssets(page)
  if (!assets) throw new Error(`No assets found for page: ${page}`)

  // Pre-computing as much as possible during the initialization phase

  const customizationCoep = buildCustomizationCoep(customization)
  const customizationCsp = buildCustomizationCsp(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const customizationData = buildCustomizationData(customization)

  // Since we are loading avatars form other origins, which might not have
  // CORP headers, we need to use the "credentialless" value, which allows
  // loading cross-origin resources without credentials (cookies, client
  // certificates, etc.). This is a more secure alternative to
  // "unsafe-none". Ideally, we would want to set COEP to "require-corp" and
  // ensure that all cross-origin resources have the appropriate CORP
  // headers.
  const coep = customizationCoep ?? CrossOriginEmbedderPolicy.credentialless

  const csp = mergeCsp(SPA_CSP, AVATAR_CSP, ...customizationCsp)

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
        bodyAttrs: { class: 'text-foreground bg-background' },
        csp: mergeCsp(csp, options.csp),
        coep: options.coep ?? coep,
        meta: [{ name: 'robots', content: 'noindex' }],
        body: html`<div id="root"></div>`,
        scripts: [script, ...assets.scripts],
        styles: [...assets.styles, customizationCss],
      }),
    )
  }
}
