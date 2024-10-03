import {
  Middleware,
  validateFetchDest,
  validateFetchSite,
  writeStream,
} from '../lib/http/index.js'

import { ASSETS_URL_PREFIX, getAsset } from './index.js'

export function authorizeAssetsMiddleware(): Middleware {
  return async function assetsMiddleware(req, res, next): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith(ASSETS_URL_PREFIX)) return next()

    const [pathname, query] = req.url.split('?', 2) as [
      string,
      string | undefined,
    ]
    const filename = pathname.slice(ASSETS_URL_PREFIX.length)
    if (!filename) return next()

    const asset = await getAsset(filename).catch(() => null)
    if (!asset) return next()

    try {
      // Allow "null" (ie. no header) to allow loading assets outside of a
      // fetch context (not from a web page).
      validateFetchSite(req, res, [null, 'same-origin'])
      validateFetchDest(req, res, [null, 'style', 'script'])
    } catch (err) {
      return next(err)
    }

    if (req.headers['if-none-match'] === asset.sha256) {
      return void res.writeHead(304).end()
    }

    res.setHeader('ETag', asset.sha256)

    if (query === asset.sha256) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }

    writeStream(res, asset.createStream(), { contentType: asset.type })
  }
}
