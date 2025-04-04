import { assets } from '@atproto/oauth-provider-ui'
import {
  Middleware,
  validateFetchDest,
  validateFetchSite,
  writeStream,
} from '../lib/http/index.js'

export const ASSETS_URL_PREFIX = '/@atproto/oauth-provider/~assets/'

export function buildAssetUrl(filename: string): string {
  return `${ASSETS_URL_PREFIX}${encodeURIComponent(filename)}`
}

export function authorizeAssetsMiddleware(): Middleware {
  return async function assetsMiddleware(req, res, next): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith(ASSETS_URL_PREFIX)) return next()

    const filename = req.url.slice(ASSETS_URL_PREFIX.length)
    if (!filename) return next()

    const asset = assets.get(filename)
    if (!asset) return next()

    try {
      // Allow "null" (ie. no header) to allow loading assets outside of a
      // fetch context (not from a web page).
      validateFetchSite(req, res, [null, 'none', 'cross-site', 'same-origin'])
      validateFetchDest(req, res, [null, 'document', 'style', 'script'])
    } catch (err) {
      return next(err)
    }

    if (req.headers['if-none-match'] === asset.sha256) {
      return void res.writeHead(304).end()
    }

    res.setHeader('ETag', asset.sha256)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    writeStream(res, asset.stream(), { contentType: asset.mime })
  }
}
