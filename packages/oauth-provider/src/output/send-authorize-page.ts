import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'
import { IncomingMessage, ServerResponse } from 'node:http'

import { DeviceAccountInfo } from '../account/account-store.js'
import { Account } from '../account/account.js'
import { getAsset } from '../assets/index.js'
import { Client } from '../client/client.js'
import { cssCode, html } from '../lib/html/index.js'
import { declareBrowserGlobalVar, sendWebPage } from '../lib/http/index.js'
import { RequestUri } from '../request/request-uri.js'
import {
  Customization,
  buildCustomizationCss,
  buildCustomizationData,
} from './customization.js'

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
  req: IncomingMessage,
  res: ServerResponse,
  data: AuthorizationResultAuthorize,
  customization?: Customization,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Permissions-Policy', 'otp-credentials=*, document-domain=()')

  return sendWebPage(res, {
    scripts: [
      declareBrowserGlobalVar(
        '__customizationData',
        buildCustomizationData(customization),
      ),
      declareBrowserGlobalVar('__authorizeData', buildAuthorizeData(data)),
      await getAsset('main.js'),
    ],
    styles: [
      await getAsset('main.css'),
      cssCode(buildCustomizationCss(customization)),
    ],
    head: customization?.links?.map((l) => {
      return html`<link rel="${l.rel}" href="${l.href}" title="${l.title}" />`
    }),
    title: 'Authorize',
    body: html`<div id="root"></div>`,
  })
}
