import { createHash } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { CspConfig, CspValue, buildCsp, mergeCsp } from '../lib/csp/index.js'
import {
  AssetRef,
  BuildDocumentOptions,
  Html,
  buildDocument,
  js,
} from '../lib/html/index.js'
import { WriteResponseOptions, writeHtml } from '../lib/http/response.js'

export function declareBackendData(name: string, data: unknown) {
  // The script tag is removed after the data is assigned to the global variable
  // to prevent other scripts from deducing the value of the variable. The "app"
  // script will read the global variable and then unset it. See
  // "readBackendData" in "src/assets/app/backend-types.ts".
  return js`window[${name}]=${data};document.currentScript.remove();`
}

export type SendWebPageOptions = BuildDocumentOptions &
  WriteResponseOptions & {
    csp?: CspConfig
  }

export async function sendWebPage(
  res: ServerResponse,
  options: SendWebPageOptions,
): Promise<void> {
  const csp = mergeCsp(options.csp, {
    'default-src': ["'none'"],
    'base-uri': options.base?.origin as undefined | `https://${string}`,
    'script-src': ["'self'", ...assetsToCsp(options.scripts)],
    'style-src': ["'self'", ...assetsToCsp(options.styles)],
    'img-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'"],
    'upgrade-insecure-requests': true,

    // Prevents the CSP to be embedded in a page <meta>:
    'frame-ancestors': ["'none'"],
  })

  // @NOTE the csp string might become too long. However, since we need to
  // specify the "frame-ancestors" directive, we can't use a meta tag. For that
  // reason, we won't try to avoid too long headers and let the proxy throw
  // in case of a too long header.
  res.setHeader('Content-Security-Policy', buildCsp(csp))

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

  const html = buildDocument(options)

  return writeHtml(res, html.toString(), options)
}

export function* assetsToCsp(
  assets?: Iterable<Html | AssetRef>,
): Generator<CspValue> {
  if (assets) {
    for (const asset of assets) {
      yield assetToCsp(asset)
    }
  }
}

export function assetToCsp(asset: Html | AssetRef): CspValue {
  if (asset instanceof Html) {
    const hash = createHash('sha256').update(asset.toString()).digest('base64')
    return `'sha256-${hash}'`
  } else {
    return `'sha256-${asset.sha256}'`
  }
}
