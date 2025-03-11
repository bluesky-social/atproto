import {
  Middleware,
  validateFetchDest,
  validateFetchSite,
  writeStream,
} from '../lib/http/index.js'
import { Asset } from './asset.js'
import { ASSETS_URL_PREFIX, getAsset } from './index.js'

export function authorizeAssetsMiddleware(): Middleware {
  return async function assetsMiddleware(req, res, next): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith(ASSETS_URL_PREFIX)) return next()

    const [pathname, query] = req.url.split('?', 2) as [
      string,
      string | undefined,
    ]
    if (query) return next()

    const filename = pathname.slice(ASSETS_URL_PREFIX.length)
    if (!filename) return next()

    let asset: Asset
    try {
      asset = getAsset(filename)
    } catch {
      // Filename not found or not valid
      return next()
    }

    try {
      // Allow "null" (ie. no header) to allow loading assets outside of a
      // fetch context (not from a web page).
      validateFetchSite(req, res, [null, 'none', 'cross-site', 'same-origin'])
      validateFetchDest(req, res, [null, 'document', 'style', 'script'])
    } catch (err) {
      return next(err)
    }

    if (req.headers['if-none-match'] === asset.item.sha256) {
      return void res.writeHead(304).end()
    }

    res.setHeader('ETag', asset.item.sha256)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    writeStream(res, asset.createStream(), { contentType: asset.item.mime })
  }
}
