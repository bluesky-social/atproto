import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { Manifest } from '@atproto-labs/rollup-plugin-bundle-manifest'
import { AssetRef } from '../../lib/html/build-document.js'
import {
  Middleware,
  validateFetchDest,
  validateFetchSite,
  writeStream,
} from '../../lib/http/index.js'

type Asset =
  | {
      type: 'asset'
      mime?: string
      sha256: string
      stream: () => Readable
    }
  | {
      type: 'chunk'
      mime: string
      sha256: string
      dynamicImports: string[]
      isDynamicEntry: boolean
      isEntry: boolean
      isImplicitEntry: boolean
      name: string
      stream: () => Readable
    }

const ASSETS_URL_PREFIX = '/@atproto/oauth-provider/~assets/'

export function parseAssetsManifest(manifestPath: string) {
  // Using `require` instead of `JSON.parse(readFileSync())` so that node's
  // watch mode can pick up changes to the manifest file.

  // eslint-disable-next-line
  const manifest = require(manifestPath) as Manifest

  const assets = new Map<string, Asset>(
    Object.entries(manifest).map(([filename, { data, ...item }]) => {
      const buffer = data ? Buffer.from(data, 'base64') : null
      const filepath = join(manifestPath, '..', filename)
      const stream = buffer
        ? () => Readable.from(buffer)
        : () => createReadStream(filepath)
      return [filename, { ...item, stream }]
    }),
  )

  const assetsMiddleware: Middleware = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith(ASSETS_URL_PREFIX)) return next()

    const filename = decodeURIComponent(req.url.slice(ASSETS_URL_PREFIX.length))
    if (!filename) return next()

    const asset = assets.get(filename)
    if (!asset) return next()

    try {
      // Allow "null" (ie. no header) to allow loading assets outside of a
      // fetch context (not from a web page).
      validateFetchSite(req, [null, 'none', 'cross-site', 'same-origin'])
      validateFetchDest(req, [null, 'document', 'style', 'script'])
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

  return {
    getAssets,
    assetsMiddleware,
  }

  function getAssets(entryName: string) {
    const scripts = getScripts(entryName)
    if (!scripts.length) return null
    const styles = getStyles(entryName)
    return { scripts, styles }
  }

  function getScripts(entryName: string) {
    return Array.from(assets)
      .filter(
        ([, asset]) =>
          asset.type === 'chunk' && asset.isEntry && asset.name === entryName,
      )
      .map(assetEntryUrl)
  }

  function getStyles(_entryName: string) {
    return Array.from(assets)
      .filter(([, asset]) => asset.mime === 'text/css')
      .map(assetEntryUrl)
  }
}

function assetEntryUrl([filename]: [string, Asset]): AssetRef {
  return { url: assetUrl(filename) }
}

function assetUrl(filename: string) {
  return `${ASSETS_URL_PREFIX}${encodeURIComponent(filename)}`
}
