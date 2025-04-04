import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  AuthorizeData,
  AvailableLocales,
  CustomizationData,
  LinkDefinition,
  Session,
} from '@atproto/oauth-provider-api'
import { AVAILABLE_LOCALES, assets } from '@atproto/oauth-provider-ui'
import { Customization } from '../../customization/customization.js'
import { CspConfig, mergeCsp } from '../../lib/csp/index.js'
import { declareBackendData } from '../../lib/html/backend-data.js'
import { LinkAttrs, cssCode, html, isLinkRel } from '../../lib/html/index.js'
import { extractLocales } from '../../lib/http/request.js'
import { CrossOriginEmbedderPolicy } from '../../lib/http/security-headers.js'
import { sendWebPage } from '../../lib/send-web-page.js'
import { AuthorizationResultAuthorize } from '../../result/authorization-result-authorize.js'
import { setupCsrfToken } from '../csrf.js'
import { buildAssetUrl } from './assets-middleware.js'
import { buildCustomizationCss } from './build-customization-css.js'
import { buildCustomizationData } from './build-customization-data.js'
import { negotiateLocale } from './negotiate-locale.js'

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
    data: AuthorizationResultAuthorize,
  ): Promise<void> {
    const locale = negotiateLocale(
      data.parameters.ui_locales?.split(' ') ?? extractLocales(req),
    )

    await setupCsrfToken(req, res)

    // Matches the variables in "authorization-page.tsx"
    const hydrationData: {
      __availableLocales: AvailableLocales
      __customizationData: CustomizationData
      __authorizeData: AuthorizeData
    } = {
      __availableLocales: AVAILABLE_LOCALES,
      __customizationData: customizationData,
      __authorizeData: buildAuthorizeData(data),
    }

    return sendWebPage(res, {
      meta: [{ name: 'robots', content: 'noindex' }],
      links: buildLinks(locale),
      htmlAttrs: { lang: locale },
      body: html`<div id="root"></div>`,
      csp,
      coep,
      scripts: [declareBackendData(hydrationData), ...scripts],
      styles: [...styles, customizationCss],
    })
  }
}

export function buildAuthorizeData(
  data: AuthorizationResultAuthorize,
): AuthorizeData {
  return {
    clientId: data.client.id,
    clientMetadata: data.client.metadata,
    clientTrusted: data.client.info.isTrusted,
    requestUri: data.authorize.uri,
    loginHint: data.parameters.login_hint,
    scopeDetails: data.authorize.scopeDetails,
    sessions: data.authorize.sessions.map(
      (session): Session => ({
        // Map to avoid leaking other data that might be present in the session
        account: session.account,
        selected: session.selected,
        loginRequired: session.loginRequired,
        consentRequired: session.consentRequired,
      }),
    ),
  }
}
