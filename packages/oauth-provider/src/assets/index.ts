type ManifestItem =
  import('@atproto/rollup-plugin-bundle-manifest').ManifestItem

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
import { join } from 'node:path'
import { Readable } from 'node:stream'

// @ts-expect-error: This file is generated at build time
import manifestData from '../app/bundle-manifest.json'

const assets: Map<string, ManifestItem> = new Map(Object.entries(manifestData))

async function getAsset(
  filename: string,
): Promise<{ asset: ManifestItem; path: string }> {
  // Prevent directory traversal attacks
  if (
    filename.includes(':') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.startsWith('.')
  ) {
    throw new AssetNotFoundError(filename)
  }

  const asset = assets.get(filename)
  if (!asset) throw new AssetNotFoundError(filename)

  // We make it extra easy on the bundler by providing a list of known assets
  // instead of relying on globbing (globbing with
  // 'rollup-plugin-import-meta-assets' requires a file extension anyway).

  // return {
  //   asset,
  //   url: new URL(`../app/${filename}`, import.meta.url),
  // }

  switch (filename) {
    case 'main.js':
      return {
        asset,
        path: join(__dirname, '../app/main.js'),
      }
    case 'main.js.map':
      return {
        asset,
        path: join(__dirname, '../app/main.js.map'),
      }
    case 'main.css':
      return {
        asset,
        path: join(__dirname, '../app/main.css'),
      }
    case 'main.css.map':
      return {
        asset,
        path: join(__dirname, '../app/main.css.map'),
      }
    default:
      // Should never happen
      throw new AssetNotFoundError(filename)
  }
}

export async function findAsset(
  filename: string,
): Promise<{ asset: ManifestItem; getStream: () => Readable }> {
  const { asset, path } = await getAsset(filename)

  // When this package is used as a regular "node_modules" dependency, and gets
  // bundled by the consumer, the assets should be copied to the output
  // directory. In case the bundler does not support copying assets based on the
  // "new URL(path, import.meta.url)" pattern, this package's build system can
  // be modified to embed the asset data directly into the bundle metadata (see
  // rollup.config.mjs).

  const { data } = asset

  return {
    asset,
    getStream: data
      ? () => Readable.from(Buffer.from(data, 'base64'))
      : () => createReadStream(path),
  }
}

class AssetNotFoundError extends Error {
  public readonly code = 'ENOENT'
  public readonly statusCode = 404
  constructor(filename: string) {
    super(`Asset not found: ${filename}`)
  }
}
