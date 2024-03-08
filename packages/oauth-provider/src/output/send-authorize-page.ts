import { IncomingMessage, ServerResponse } from 'node:http'

import { Html, html } from '@atproto/html'

import { Account } from '../account/account.js'
import { getAsset } from '../assets/index.js'
import { Client } from '../client/client.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { RequestUri } from '../request/request-uri.js'
import { Branding, buildBrandingCss, buildBrandingData } from './branding.js'
import { declareBrowserGlobalVar, sendWebApp } from './send-web-app.js'

export type AuthorizationResultAuthorize = {
  issuer: string
  client: Client
  parameters: AuthorizationParameters
  authorize: {
    uri: RequestUri
    sessions: readonly {
      account: Account
      loginRequired: boolean
      consentRequired: boolean
      initiallySelected: boolean
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
    consentRequired: data.parameters.prompt === 'consent',
    sessions: data.authorize.sessions,
  }
}

export async function sendAuthorizePage(
  req: IncomingMessage,
  res: ServerResponse,
  data: AuthorizationResultAuthorize,
  branding?: Branding,
): Promise<void> {
  return sendWebApp(req, res, {
    scripts: [
      declareBrowserGlobalVar('__brandingData', buildBrandingData(branding)),
      declareBrowserGlobalVar('__authorizeData', buildAuthorizeData(data)),
      await getAsset('main.js'),
    ],
    styles: [
      await getAsset('main.css'),
      Html.dangerouslyCreate([buildBrandingCss(branding)]),
    ],
    title: 'Authorize',
    body: html`<div id="root"></div>`,
  })
}
