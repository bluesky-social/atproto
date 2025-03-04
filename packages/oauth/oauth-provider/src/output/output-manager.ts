import type { ServerResponse } from 'node:http'
import { Asset } from '../assets/asset.js'
import { enumerateAssets, getAsset } from '../assets/index.js'
import { CspConfig, mergeCsp } from '../lib/csp/index.js'
import { Html, cssCode, html } from '../lib/html/index.js'
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
import {
  assetsToCsp,
  declareBackendData,
  sendWebPage,
} from './send-web-page.js'

const HCAPTCHA_CSP = {
  'script-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'frame-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'style-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'connect-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
} as const satisfies CspConfig

export class OutputManager {
  readonly links?: readonly LinkDefinition[]
  readonly scripts: readonly (Asset | Html)[]
  readonly styles: readonly (Asset | Html)[]
  readonly csp: CspConfig

  constructor(customization: Customization) {
    this.links = customization.branding?.links

    // Note: building scripts/styles/csp here for two reasons:
    // 1. To avoid re-building it on every request
    // 2. To throw during init if the customization/config is invalid

    this.scripts = [
      declareBackendData(
        '__customizationData',
        buildCustomizationData(customization),
      ),
      // Last (to be able to read the "backend data" variables)
      getAsset('main.js'),
    ]

    this.styles = [
      // First (to be overridden by customization)
      getAsset('main.css'),
      cssCode(buildCustomizationCss(customization)),
    ]

    const customizationCsp = customization?.hcaptcha ? HCAPTCHA_CSP : undefined
    const assetsCsp: CspConfig = {
      'script-src': [...assetsToCsp(enumerateAssets('main.js'))],
      'style-src': [...assetsToCsp(enumerateAssets('main.css'))],
    }

    this.csp = mergeCsp(customizationCsp, assetsCsp)
  }

  async sendAuthorizePage(
    res: ServerResponse,
    data: AuthorizationResultAuthorize,
  ): Promise<void> {
    return sendWebPage(res, {
      scripts: [
        declareBackendData('__authorizeData', buildAuthorizeData(data)),
        ...this.scripts,
      ],
      styles: this.styles,
      links: this.links,
      htmlAttrs: { lang: 'en' },
      body: html`<div id="root"></div>`,
      csp: this.csp,
    })
  }

  async sendErrorPage(res: ServerResponse, err: unknown): Promise<void> {
    return sendWebPage(res, {
      status: buildErrorStatus(err),
      scripts: [
        declareBackendData('__errorData', buildErrorPayload(err)),
        ...this.scripts,
      ],
      styles: this.styles,
      links: this.links,
      htmlAttrs: { lang: 'en' },
      body: html`<div id="root"></div>`,
      csp: this.csp,
    })
  }
}
