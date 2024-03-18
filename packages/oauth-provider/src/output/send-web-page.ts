import { createHash } from 'node:crypto'
import { ServerResponse } from 'node:http'

import { html, Html, jsonCode } from '@atproto/html'
import { writeHtml } from '@atproto/http-util'

import { Asset } from '../assets/asset.js'

export type WebPageOptions = {
  lang?: string
  base?: URL
  meta?: Record<string, Html | string>
  head?: Html | Html[]
  title?: string
  scripts?: (Html | Asset)[]
  styles?: (Html | Asset)[]
  body: Html | Html[]
}

export function buildWebPage({
  lang = 'en',
  head,
  title,
  body,
  base,
  meta,
  scripts,
  styles,
}: WebPageOptions) {
  if (!meta?.viewport) {
    meta = { ...meta, viewport: 'width=device-width, initial-scale=1.0' }
  }

  return html`
    <!DOCTYPE html>
    <html lang="${lang}">
      <head>
        <meta charset="UTF-8" />
        ${title && html`<title>${title}</title>`}
        ${base && html`<base href="${base.href}" />`}
        ${Object.entries(meta).map(([name, content]) => {
          return html`<meta name="${name}" content="${content}" />`
        })}
        ${head} ${styles?.map(styleToHtml)}
      </head>
      <body>
        ${body} ${scripts?.map(scriptToHtml)}
      </body>
    </html>
  `
}

export function declareBrowserGlobalVar(name: string, data: unknown) {
  const nameJson = jsonCode(name)
  const dataJson = jsonCode(data)
  return html`window[${nameJson}]=${dataJson};document.currentScript.remove();`
}

function scriptToHtml(script: Html | Asset) {
  return script instanceof Html
    ? // prettier-ignore
      html`<script>${script}</script>` // hash validity requires no space around the content
    : html`<script type="module" src="${script.url}?${script.sha256}"></script>`
}

function styleToHtml(style: Html | Asset) {
  return style instanceof Html
    ? // prettier-ignore
      html`<style>${style}</style>` // hash validity requires no space around the content
    : html`<link rel="stylesheet" href="${style.url}?${style.sha256}" />`
}

export function sendWebPage(
  res: ServerResponse,
  { status = 200, ...options }: WebPageOptions & { status?: number },
): void {
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
      `base-uri ${options.base?.origin || `'none'`}`,
      `script-src 'self' ${
        options.scripts?.map(assetToHash).map(hashToCspRule).join(' ') ?? ''
      }`,
      `style-src 'self' ${
        options.styles?.map(assetToHash).map(hashToCspRule).join(' ') ?? ''
      }`,
      `img-src 'self' data: https:`,
      `connect-src 'self'`,
      `upgrade-insecure-requests`,
    ].join('; '),
  )

  const webPage = buildWebPage(options)

  writeHtml(res, webPage.toString(), status)
}

function assetToHash(asset: Html | Asset): string {
  return asset instanceof Html
    ? createHash('sha256').update(asset.toString()).digest('base64')
    : asset.sha256
}

function hashToCspRule(hash: string): string {
  return `'sha256-${hash}'`
}
