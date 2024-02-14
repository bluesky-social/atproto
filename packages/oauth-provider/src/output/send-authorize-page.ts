import { createHash } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'

import { html } from '@atproto/html'
import { Middleware, writeHtml, writeStream } from '@atproto/http-util'

import { Account } from '../account/account.js'
import { findAsset } from '../assets/index.js'
import { Client } from '../client/client.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { RequestUri } from '../request/request-uri.js'

export function authorizeAssetsMiddleware(prefix: string): Middleware {
  if (!prefix.startsWith('/')) throw new TypeError('Prefix must start with /')
  if (!prefix.endsWith('/')) prefix += '/'

  return async function assetsMiddleware(req, res, next): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith(prefix)) return next()

    const [pathname, query] = req.url.split('?', 2) as [
      string,
      string | undefined,
    ]
    const filename = pathname.slice(prefix.length)

    const item = await findAsset(filename).catch(() => null)
    if (!item) return next()

    if (req.headers['if-none-match'] === item.asset.sha256) {
      return void res.writeHead(304).end()
    }

    res.setHeader('ETag', item.asset.sha256)

    if (query === item.asset.sha256) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }

    await writeStream(res, item.getStream(), item.asset.mime)
  }
}

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

function buildBackendData(data: AuthorizationResultAuthorize) {
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
): Promise<void> {
  const [{ asset: mainJs }, { asset: mainCss }] = await Promise.all([
    findAsset('main.js'),
    findAsset('main.css'),
  ])

  const backendDataScript = html
    .dangerouslyCreate(
      `window.__backendData=${html.jsonForScriptTag(buildBackendData(data))};`,
    )
    .toString()
  const backendDataScriptSha = createHash('sha256')
    .update(backendDataScript)
    .digest('base64')
  const backendDataScriptHtml = html.dangerouslyCreate(
    `<script>${backendDataScript}</script>`,
  )

  /* Security headers */

  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Permissions-Policy', 'otp-credentials=*, document-domain=()')
  res.setHeader('Strict-Transport-Security', 'max-age=63072000')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader(
    'Content-Security-Policy',
    [
      `default-src 'none'`,
      `frame-ancestors 'none'`,
      `form-action 'none'`,
      `base-uri 'none'`,

      `script-src 'self' 'sha256-${mainJs.sha256}' 'sha256-${backendDataScriptSha}'`,
      `style-src 'self' 'sha256-${mainCss.sha256}'`,
      `img-src 'self' https:`,
      `connect-src 'self'`,
      `upgrade-insecure-requests`,
    ].join('; '),
  )

  const payload = html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="main.css?${mainCss.sha256}" />
        <title>Authorize</title>
      </head>
      <body>
        <div id="root"></div>

        ${backendDataScriptHtml}
        <script type="module" src="main.js?${mainJs.sha256}"></script>
      </body>
    </html>
  `

  writeHtml(res, payload.toBuffer())
}
