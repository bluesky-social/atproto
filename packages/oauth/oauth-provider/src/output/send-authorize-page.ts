import type { ServerResponse } from 'node:http'
import { LinkDefinition } from '@atproto/oauth-provider-api'
import { assets } from '@atproto/oauth-provider-ui'
import { CspConfig, mergeCsp } from '../lib/csp/index.js'
import { LinkAttrs, cssCode, html, isLinkRel } from '../lib/html/index.js'
import { CrossOriginEmbedderPolicy } from '../lib/http/security-headers.js'
import { AVAILABLE_LOCALES, negotiateLocale } from '../lib/locale.js'
import { buildAssetUrl } from './assets-middleware.js'
import { declareBackendData } from './backend-data.js'
import {
  AuthorizationResultAuthorize,
  buildAuthorizeData,
} from './build-authorize-data.js'
import {
  Customization,
  buildCustomizationCss,
  buildCustomizationData,
} from './build-customization-data.js'
import { sendWebPage } from './send-web-page.js'

export type SendPageOptions = {
  preferredLocales?: readonly string[]
}

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
  const links = customization.branding?.links
  const buildLinks = (locale: string) =>
    links
      ?.map(({ rel, href, title }: LinkDefinition): LinkAttrs | undefined =>
        isLinkRel(rel)
          ? typeof title === 'string'
            ? { href, rel, title }
            : { href, rel, title: title[locale] || title.en }
          : undefined,
      )
      .filter((v) => v != null)

  // Pre-computed options:
  const customizationData = buildCustomizationData(customization)
  const customizationCss = cssCode(buildCustomizationCss(customization))
  const scripts = Array.from(assets)
    .filter(
      ([, item]) =>
        item.type === 'chunk' &&
        item.isEntry &&
        item.name === 'authorization-page',
    )
    .map(([filename]) => ({ url: buildAssetUrl(filename) }))
  const styles = Array.from(assets)
    .filter(([, item]) => item.mime === 'text/css')
    .map(([filename]) => ({ url: buildAssetUrl(filename) }))
  const csp = mergeCsp(
    AUTHORIZATION_PAGE_CSP,
    customization?.hcaptcha ? HCAPTCHA_CSP : undefined,
  )

  return async function sendAuthorizePage(
    res: ServerResponse,
    data: AuthorizationResultAuthorize,
    options?: SendPageOptions,
  ): Promise<void> {
    const locale = negotiateLocale(
      data.parameters.ui_locales?.split(' ') ?? options?.preferredLocales,
    )

    return sendWebPage(res, {
      meta: [
        { name: 'robots', content: 'noindex' },
        // @TODO: Localize the description
        { name: 'description', content: 'ATProto OAuth authorization page' },
      ],
      links: buildLinks(locale),
      htmlAttrs: { lang: locale },
      body: html`<div id="root"></div>`,
      csp,
      // Because we are loading avatar images from external sources, that might
      // not have CORP headers set, we need to use at least "credentialless".
      coep: customization?.hcaptcha
        ? // https://github.com/hCaptcha/react-hcaptcha/issues/259
          // @TODO Remove the use of `unsafeNone` once the issue above is resolved
          CrossOriginEmbedderPolicy.unsafeNone
        : CrossOriginEmbedderPolicy.credentialless,
      scripts: [
        declareBackendData({
          __availableLocales: AVAILABLE_LOCALES,
          __customizationData: customizationData,
          __authorizeData: buildAuthorizeData(data),
        }),
        // After data
        ...scripts,
      ],
      styles: [
        ...styles,
        // Last (to be able to override the default styles)
        customizationCss,
      ],
    })
  }
}
