import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'
import { ServerResponse } from 'node:http'

import { DeviceAccountInfo } from '../account/account-store.js'
import { Account } from '../account/account.js'
import { getAsset } from '../assets/index.js'
import { Client } from '../client/client.js'
import { cssCode, html } from '../lib/html/index.js'
import { RequestUri } from '../request/request-uri.js'
import {
  Customization,
  buildCustomizationCss,
  buildCustomizationData,
} from './customization.js'
import { declareBackendData, sendApp } from './send-app.js'

export type AuthorizationResultAuthorize = {
  issuer: string
  client: Client
  parameters: OAuthAuthenticationRequestParameters
  authorize: {
    uri: RequestUri
    sessions: readonly {
      account: Account
      info: DeviceAccountInfo

      selected: boolean
      loginRequired: boolean
      consentRequired: boolean
    }[]
  }
}

function buildAuthorizeData(data: AuthorizationResultAuthorize) {
  return {
    csrfCookie: `csrf-${data.authorize.uri}`,
    requestUri: data.authorize.uri,
    clientId: data.client.id,
    clientMetadata: data.client.metadata,
    loginHint: data.parameters.login_hint,
    newSessionsRequireConsent:
      data.parameters.prompt === 'login' ||
      data.parameters.prompt === 'consent',
    sessions: data.authorize.sessions.map((session) => ({
      account: session.account,

      selected: session.selected,
      loginRequired: session.loginRequired,
      consentRequired: session.consentRequired,
    })),
  }
}

export async function sendAuthorizePage(
  res: ServerResponse,
  data: AuthorizationResultAuthorize,
  customization?: Customization,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Permissions-Policy', 'otp-credentials=*, document-domain=()')

  const [jsAsset, cssAsset] = await Promise.all([
    getAsset('main.js'),
    getAsset('main.css'),
  ])

  return sendApp(res, {
    scripts: [
      declareBackendData(
        '__customizationData',
        buildCustomizationData(customization),
      ),
      declareBackendData('__authorizeData', buildAuthorizeData(data)),
      jsAsset, // Last (to be able to read the global variables)
    ],
    styles: [
      cssAsset, // First (to be overridden by customization)
      cssCode(buildCustomizationCss(customization)),
    ],
    links: customization?.links,
    htmlAttrs: { lang: 'en' },
    title: 'Authorize',
    body: html`<div id="root"></div>`,
  })
}
