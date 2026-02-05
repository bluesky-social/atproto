import { createHash } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { CspValue, mergeCsp } from './csp/index.js'
import {
  AssetRef,
  BuildDocumentOptions,
  Html,
  buildDocument,
} from './html/index.js'
import { WriteResponseOptions, writeBuffer } from './http/response.js'
import {
  SecurityHeadersOptions,
  setSecurityHeaders,
} from './http/security-headers.js'

export type WriteHtmlOptions = BuildDocumentOptions &
  WriteResponseOptions &
  SecurityHeadersOptions

export function writeHtml(
  res: ServerResponse,
  options: WriteHtmlOptions,
): void {
  // @NOTE the csp string might be quite long. In that case it might be tempting
  // to set it through the http-equiv <meta> in the HTML. However, some
  // directives cannot be enforced by browsers when set through the meta tag
  // (e.g. 'frame-ancestors'). Therefore, it's better to set the CSP through the
  // HTTP header.
  const csp = mergeCsp(
    {
      // Keep "upgrade-insecure-requests" in sync with HSTS setting. HSTS is
      // typically set to false for localhost endpoints. Chrome and FF will
      // ignore "upgrade-insecure-requests" from localhost, but Safari will
      // enforce it, requiring to be explicitly disable it for localhost.
      'upgrade-insecure-requests': options.hsts !== false,
      'default-src': ["'none'"],
      'base-uri': options.base?.origin as undefined | `https://${string}`,
      'script-src': options.scripts?.map(assetToCsp).filter((v) => v != null),
      'style-src': options.styles?.map(assetToCsp).filter((v) => v != null),
    },
    options.csp,
  )

  const html = buildDocument(options).toString()

  // HTML pages should always be served with safety protection headers
  setSecurityHeaders(res, { ...options, csp })
  writeBuffer(res, html, {
    ...options,
    contentType: options?.contentType ?? 'text/html; charset=utf-8',
  })
}

function assetToCsp(asset?: Html | AssetRef): undefined | CspValue {
  if (asset == null) return undefined
  if (asset instanceof Html) {
    // Inline assets are "allowed" by their hash
    const hash = createHash('sha256')
    for (const fragment of asset) hash.update(fragment)
    return `'sha256-${hash.digest('base64')}'`
  } else {
    // External assets are referenced by their origin
    if (asset.url.startsWith('https:') || asset.url.startsWith('http:')) {
      return new URL(asset.url).origin as `https:${string}` | `http:${string}`
    }

    // Internal assets are served from the same origin
    return `'self'`
  }
}
