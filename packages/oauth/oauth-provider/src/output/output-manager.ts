import type { ServerResponse } from 'node:http'
import { assets } from '@atproto/oauth-provider-ui'
import { buildAssetUrl } from '../assets/assets-middleware.js'
import { CspConfig, mergeCsp } from '../lib/csp/index.js'
import {
  AssetRef,
  Html,
  LinkAttrs,
  MetaAttrs,
  cssCode,
  html,
  isLinkRel,
} from '../lib/html/index.js'
import { CrossOriginEmbedderPolicy } from '../lib/http/security-headers.js'
import { AVAILABLE_LOCALES, Locale, isAvailableLocale } from '../lib/locale.js'
import { declareBackendData } from './backend-data.js'
import {
  AuthorizationResultAuthorize,
  buildAuthorizeData,
} from './build-authorize-data.js'
import {
  Customization,
  LinkDefinition,
  buildCustomizationCss,
  buildCustomizationData,
} from './build-customization-data.js'
import { buildErrorPayload, buildErrorStatus } from './build-error-payload.js'
import { sendWebPage } from './send-web-page.js'

const BASE_CSP: CspConfig = {
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

export type SendPageOptions = {
  preferredLocales?: readonly string[]
}

export class OutputManager {
  readonly links?: readonly LinkDefinition[]
  readonly meta: readonly MetaAttrs[] = [
    { name: 'robots', content: 'noindex' },
    { name: 'description', content: 'ATProto OAuth authorization page' },
  ]
  readonly scripts: readonly (AssetRef | Html)[]
  readonly styles: readonly (AssetRef | Html)[]
  readonly csp: CspConfig
  readonly coep: CrossOriginEmbedderPolicy

  constructor(customization: Customization) {
    this.links = customization.branding?.links

    // Note: building scripts/styles/csp here for two reasons:
    // 1. To avoid re-building it on every request
    // 2. To throw during init if the customization/config is invalid

    this.scripts = [
      declareBackendData({
        __availableLocales: AVAILABLE_LOCALES,
        __customizationData: buildCustomizationData(customization),
      }),
      // Last (to be able to read the "backend data" variables)
      ...Array.from(assets)
        .filter(
          ([, item]) =>
            item.type === 'chunk' &&
            item.mime === 'application/javascript' &&
            item.isEntry,
        )
        .map(([filename]) => ({ url: buildAssetUrl(filename) })),
    ]

    this.styles = [
      // First (to be overridden by customization)
      ...Array.from(assets)
        .filter(([, item]) => item.mime === 'text/css')
        .map(([filename]) => ({ url: buildAssetUrl(filename) })),
      cssCode(buildCustomizationCss(customization)),
    ]

    this.csp = mergeCsp(
      BASE_CSP,
      customization?.hcaptcha ? HCAPTCHA_CSP : undefined,
    )
    // Because we are loading avatar images from external sources, that might
    // not have CORP headers set, we need to use at least "credentialless".
    this.coep = customization?.hcaptcha
      ? // https://github.com/hCaptcha/react-hcaptcha/issues/259
        // @TODO Remove the use of `unsafeNone` once the issue above is resolved
        CrossOriginEmbedderPolicy.unsafeNone
      : CrossOriginEmbedderPolicy.credentialless
  }

  async sendAuthorizePage(
    res: ServerResponse,
    data: AuthorizationResultAuthorize,
    options?: SendPageOptions,
  ): Promise<void> {
    const locale = negotiateLocale(
      data.parameters.ui_locales?.split(' ') ?? options?.preferredLocales,
    )

    return sendWebPage(res, {
      scripts: [
        declareBackendData({ __authorizeData: buildAuthorizeData(data) }),
        ...this.scripts,
      ],
      styles: this.styles,
      meta: this.meta,
      links: this.buildLinks(locale),
      htmlAttrs: { lang: locale },
      body: html`<div id="root"></div>`,
      csp: this.csp,
      coep: this.coep,
    })
  }

  async sendErrorPage(
    res: ServerResponse,
    err: unknown,
    options?: SendPageOptions,
  ): Promise<void> {
    const locale = negotiateLocale(options?.preferredLocales)

    return sendWebPage(res, {
      status: buildErrorStatus(err),
      scripts: [
        declareBackendData({ __errorData: buildErrorPayload(err) }),
        ...this.scripts,
      ],
      styles: this.styles,
      meta: this.meta,
      links: this.buildLinks(locale),
      htmlAttrs: { lang: locale },
      body: html`<div id="root"></div>`,
      csp: this.csp,
      coep: this.coep,
    })
  }

  buildLinks(locale: Locale) {
    return this.links
      ?.map(({ rel, href, title }: LinkDefinition): LinkAttrs | undefined =>
        isLinkRel(rel)
          ? typeof title === 'string'
            ? { href, rel, title }
            : { href, rel, title: title[locale] || title.en }
          : undefined,
      )
      .filter((v) => v != null)
  }
}

function negotiateLocale(desiredLocales?: readonly string[]): Locale {
  if (desiredLocales) {
    for (const locale of desiredLocales) {
      if (locale === '*') break // use default
      if (isAvailableLocale(locale)) return locale
    }
  }
  return 'en'
}
