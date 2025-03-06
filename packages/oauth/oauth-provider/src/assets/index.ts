// If this library is used as a regular dependency (e.g. from node_modules), the
// assets will simply be referenced from the node_modules directory. However, if
// this library is bundled (e.g. via rollup), the assets need to be copied to
// the output directory. Most bundlers support this (webpack, rollup, etc.) by
// re-writing new URL('./path', import.meta.url) calls to point to the correct
// output directory.
//
// https://github.com/evanw/esbuild/issues/795
// https://www.npmjs.com/package/@web/rollup-plugin-import-meta-assets

// Note that the bundle-manifest, being a JSON file, can be imported directly
// without any special handling. This is because all bundlers support JSON
// imports out of the box.

import { createReadStream } from 'node:fs'
import { join, posix } from 'node:path'
import { Readable } from 'node:stream'
import type { ManifestItem } from '@atproto-labs/rollup-plugin-bundle-manifest'
// @ts-expect-error: This file is generated at build time
// eslint-disable-next-line import/no-unresolved
import appBundleManifestJson from './app/bundle-manifest.json'
import { Asset } from './asset.js'

const appBundleManifest: Map<string, ManifestItem> = new Map(
  Object.entries(appBundleManifestJson),
)

export const ASSETS_URL_PREFIX = '/@atproto/oauth-provider/~assets/'

export function* enumerateAssets(mime: string): IteratorObject<Asset, void> {
  for (const [filename, manifest] of appBundleManifest) {
    if (manifest.mime === mime) {
      yield manifestItemToAsset(filename, manifest)
    }
  }
}

export function getAsset(inputFilename: string): Asset {
  const filename = posix.normalize(inputFilename)

  if (
    filename.startsWith('/') || // Prevent absolute paths
    filename.startsWith('../') || // Prevent directory traversal attacks
    /[<>:"|?*\\]/.test(filename) // Windows disallowed characters
  ) {
    throw new AssetNotFoundError(filename)
  }

  const manifest = appBundleManifest.get(filename)
  if (!manifest) throw new AssetNotFoundError(filename)

  return manifestItemToAsset(filename, manifest)
}

function manifestItemToAsset(filename: string, manifest: ManifestItem): Asset {
  // When this package is used as a regular "node_modules" dependency, and gets
  // bundled by the consumer, the assets should be copied to the bundle's output
  // directory. In case the bundler does not support copying assets from the
  // "dist/assets/app" folder, this package's build system can be modified to
  // embed the asset data directly into the bundle-manifest.json (see the `data`
  // option of "@atproto-labs/rollup-plugin-bundle-manifest" in rollup.config.js).

  const { data } = manifest

  return {
    url: posix.join(ASSETS_URL_PREFIX, filename),
    type: manifest.mime,
    isEntry: manifest.type === 'chunk' && manifest.isEntry,
    sha256: manifest.sha256,
    createStream: data
      ? () => Readable.from(Buffer.from(data, 'base64'))
      : () =>
          // ESM version:
          // createReadStream(new URL(`./app/${filename}`, import.meta.url))
          // CJS version:
          createReadStream(join(__dirname, './app', filename)),
  }
}

class AssetNotFoundError extends Error {
  public readonly code = 'ENOENT'
  public readonly statusCode = 404
  constructor(filename: string) {
    super(`Asset not found: ${filename}`)
  }
}
