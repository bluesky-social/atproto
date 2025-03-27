import type { ServerResponse } from 'node:http'
import { CustomizationData } from '@atproto/oauth-provider-api'
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
import { buildErrorData } from './build-error-data.js'
import { buildErrorStatus } from './build-error-payload.js'
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
  readonly csp: CspConfig
  readonly coep: CrossOriginEmbedderPolicy
  readonly customizationData: CustomizationData
  readonly customizationCss: Html

  constructor(customization: Customization) {
    this.links = customization.branding?.links

    // "cache" these:
    this.customizationData = buildCustomizationData(customization)
    this.customizationCss = cssCode(buildCustomizationCss(customization))

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

  buildAssets(
    name: string,
    backendData: Record<string, unknown>,
  ): {
    scripts: (AssetRef | Html)[]
    styles: (AssetRef | Html)[]
  } {
    return {
      scripts: [
        declareBackendData(backendData),
        // After backend injected data
        ...Array.from(assets)
          .filter(
            ([, item]) =>
              item.type === 'chunk' && item.isEntry && item.name === name,
          )
          .map(([filename]) => ({ url: buildAssetUrl(filename) })),
      ],
      styles: [
        ...Array.from(assets)
          .filter(([, item]) => item.mime === 'text/css')
          .map(([filename]) => ({ url: buildAssetUrl(filename) })),
        // Last (to be able to override the default styles)
        this.customizationCss,
      ],
    }
  }

  async sendAuthorizePage(
    res: ServerResponse,
    data: AuthorizationResultAuthorize,
    options?: SendPageOptions,
  ): Promise<void> {
    const locale = negotiateLocale(
      data.parameters.ui_locales?.split(' ') ?? options?.preferredLocales,
    )

    const { scripts, styles } = this.buildAssets('authorization-page', {
      __availableLocales: AVAILABLE_LOCALES,
      __customizationData: this.customizationData,
      __authorizeData: buildAuthorizeData(data),
    })

    return sendWebPage(res, {
      scripts,
      styles,
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

    const { scripts, styles } = this.buildAssets('error-page', {
      __availableLocales: AVAILABLE_LOCALES,
      __customizationData: this.customizationData,
      __errorData: buildErrorData(err),
    })

    return sendWebPage(res, {
      status: buildErrorStatus(err),
      scripts,
      styles,
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
