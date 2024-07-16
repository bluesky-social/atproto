import { ServerResponse } from 'node:http'

import { Asset } from '../assets/asset.js'
import { getAsset } from '../assets/index.js'
import { cssCode, Html, html } from '../lib/html/index.js'
import {
  AuthorizationResultAuthorize,
  buildAuthorizeData,
} from './build-authorize-data.js'
import { buildErrorPayload, buildErrorStatus } from './build-error-payload.js'
import {
  buildCustomizationCss,
  buildCustomizationData,
  Customization,
} from './customization.js'
import { declareBackendData, sendWebPage } from './send-web-page.js'

export class OutputManager {
  readonly customizationScript: Html
  readonly customizationStyle: Html
  readonly customizationLinks?: Customization['links']

  // Could technically cause an "UnhandledPromiseRejection", which might cause
  // the process to exit. This is intentional, as it's a critical error. It
  // should never happen in practice, as the built assets are bundled with the
  // package.
  readonly assetsPromise: Promise<[js: Asset, css: Asset]> = Promise.all([
    getAsset('main.js'),
    getAsset('main.css'),
  ] as const)

  constructor(customization?: Customization) {
    // Note: building this here for two reasons:
    // 1. To avoid re-building it on every request
    // 2. To throw during init if the customization is invalid
    this.customizationScript = declareBackendData(
      '__customizationData',
      buildCustomizationData(customization),
    )
    this.customizationStyle = cssCode(buildCustomizationCss(customization))
    this.customizationLinks = customization?.links
  }

  async sendAuthorizePage(
    res: ServerResponse,
    data: AuthorizationResultAuthorize,
  ): Promise<void> {
    const [jsAsset, cssAsset] = await this.assetsPromise

    return sendWebPage(res, {
      scripts: [
        declareBackendData('__authorizeData', buildAuthorizeData(data)),
        this.customizationScript,
        jsAsset, // Last (to be able to read the "backend data" variables)
      ],
      styles: [
        cssAsset, // First (to be overridden by customization)
        this.customizationStyle,
      ],
      links: this.customizationLinks,
      htmlAttrs: { lang: 'en' },
      title: 'Authorize',
      body: html`<div id="root"></div>`,
    })
  }

  async sendErrorPage(res: ServerResponse, err: unknown): Promise<void> {
    const [jsAsset, cssAsset] = await this.assetsPromise

    return sendWebPage(res, {
      status: buildErrorStatus(err),
      scripts: [
        declareBackendData('__errorData', buildErrorPayload(err)),
        this.customizationScript,
        jsAsset, // Last (to be able to read the "backend data" variables)
      ],
      styles: [
        cssAsset, // First (to be overridden by customization)
        this.customizationStyle,
      ],
      links: this.customizationLinks,
      htmlAttrs: { lang: 'en' },
      title: 'Error',
      body: html`<div id="root"></div>`,
    })
  }
}
