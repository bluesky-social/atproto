import { IncomingMessage, ServerResponse } from 'node:http'

import { cssCode, html } from '@atproto/html'

import { DeviceAccountInfo } from '../account/account-store.js'
import { Account } from '../account/account.js'
import { getAsset } from '../assets/index.js'
import { Client } from '../client/client.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { RequestUri } from '../request/request-uri.js'
import { Branding, buildBrandingCss, buildBrandingData } from './branding.js'
import { declareBrowserGlobalVar, sendWebPage } from './send-web-page.js'

export type AuthorizationResultAuthorize = {
  issuer: string
  client: Client
  parameters: AuthorizationParameters
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
    sessions: data.authorize.sessions,
  }
}

export async function sendAuthorizePage(
  req: IncomingMessage,
  res: ServerResponse,
  data: AuthorizationResultAuthorize,
  branding?: Branding,
): Promise<void> {
  return sendWebPage(req, res, {
    scripts: [
      declareBrowserGlobalVar('__brandingData', buildBrandingData(branding)),
      declareBrowserGlobalVar('__authorizeData', buildAuthorizeData(data)),
      await getAsset('main.js'),
    ],
    styles: [await getAsset('main.css'), cssCode(buildBrandingCss(branding))],
    title: 'Authorize',
    body: html`<div id="root"></div>`,
  })
}
