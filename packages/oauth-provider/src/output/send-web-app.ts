import { createHash } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'

import { html, Html, jsonCode } from '@atproto/html'
import { writeHtml } from '@atproto/http-util'

import { Asset } from '../assets/asset.js'

export async function sendWebApp(
  req: IncomingMessage,
  res: ServerResponse,
  {
    head,
    title,
    body,
    base,
    status = 200,
    scripts = [],
    styles = [],
  }: {
    scripts?: (Html | Asset)[]
    styles?: (Html | Asset)[]
    status?: number
    base?: URL
    title: string
    head?: Html
    body: Html
    dataVarName?: string
  },
): Promise<void> {
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
      `base-uri ${base?.origin || `'none'`}`,
      `script-src 'self' ${scripts
        .map(assetToHash)
        .map(hashToCspRule)
        .join(' ')}`,
      `style-src 'self' ${styles
        .map(assetToHash)
        .map(hashToCspRule)
        .join(' ')}`,
      `img-src 'self' data: https:`,
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
        ${base ? html`<base href="${base.href}" />` : ''}
        <title>${title}</title>
        ${head || []} ${styles.map(styleToHtml)}
      </head>
      <body>
        ${body} ${scripts.map(scriptToHtml)}
      </body>
    </html>
  `

  writeHtml(res, payload.toString(), status)
}

export function declareBrowserGlobalVar(name: string, data: unknown) {
  const nameJson = jsonCode(name)
  const dataJson = jsonCode(data)
  return html`window[${nameJson}]=${dataJson};document.currentScript.remove();`
}

function scriptToHtml(a: Html | Asset) {
  return a instanceof Html
    ? // prettier-ignore
      html`<script>${a}</script>`
    : html`<script type="module" src="${a.url}?${a.sha256}"></script>`
}

function styleToHtml(a: Html | Asset) {
  return a instanceof Html
    ? // prettier-ignore
      html`<style>${a}</style>`
    : html`<link rel="stylesheet" href="${a.url}?${a.sha256}" />`
}

function assetToHash(a: Html | Asset): string {
  return a instanceof Html
    ? createHash('sha256').update(a.toString()).digest('base64')
    : a.sha256
}

function hashToCspRule(hash: string): string {
  return `'sha256-${hash}'`
}
