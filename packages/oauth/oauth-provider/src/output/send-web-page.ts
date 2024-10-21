import { createHash } from 'node:crypto'
import { ServerResponse } from 'node:http'

import {
  AssetRef,
  buildDocument,
  BuildDocumentOptions,
  Html,
  js,
} from '../lib/html/index.js'
import { writeHtml, WriteResponseOptions } from '../lib/http/response.js'

export function declareBackendData(name: string, data: unknown) {
  // The script tag is removed after the data is assigned to the global variable
  // to prevent other scripts from deducing the value of the variable. The "app"
  // script will read the global variable and then unset it. See
  // "readBackendData" in "src/assets/app/backend-data.ts".
  return js`window[${name}]=${data};document.currentScript.remove();`
}

export type SendWebPageOptions = BuildDocumentOptions & WriteResponseOptions

export async function sendWebPage(
  res: ServerResponse,
  options: SendWebPageOptions,
): Promise<void> {
  // @TODO: make these headers configurable (?)
  res.setHeader('Permissions-Policy', 'otp-credentials=*, document-domain=()')
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Strict-Transport-Security', 'max-age=63072000')
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

  const html = buildDocument(options)

  return writeHtml(res, html.toString(), options)
}

function assetToHash(asset: Html | AssetRef): string {
  return asset instanceof Html
    ? createHash('sha256').update(asset.toString()).digest('base64')
    : asset.sha256
}

function hashToCspRule(hash: string): string {
  return `'sha256-${hash}'`
}
