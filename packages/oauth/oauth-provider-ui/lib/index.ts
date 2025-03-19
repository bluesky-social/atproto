// This file allows exposing the result of the build of the `../src` folder as
// assets that can be used from a backend service. Specifically, the assets map
// bellow exposes both the asset items from their manifest, as well as a method
// to get the stream data (as a Readable stream) of the asset.

// When this library is used as a NodeJS dependency (typically from
// node_modules), the assets will simply read on disk from the node_modules
// directory. However, if this file is bundled (e.g. via rollup), the assets
// need to be copied to the bundler's output directory for the code bellow to
// work. Most bundlers support this (webpack, rollup, etc.) by re-writing `new
// URL('./path', import.meta.url)` calls to point to the correct output
// directory.

// However, that syntax only works in ESM modules. Atproto uses CJS modules, so,
// at the moment, the logic bellow is **not** compatible with bundlers. To allow
// bundling this file as a CJS module, the code bellow should not be dependent
// on reading the files on disk. This can be done by modifying the build system
// to embed the asset bytes directly into the bundle-manifest.json (see the
// `data` option of "@atproto-labs/rollup-plugin-bundle-manifest" in
// rollup.config.js).

// https://github.com/evanw/esbuild/issues/795
// https://www.npmjs.com/package/@web/rollup-plugin-import-meta-assets

// Note that the bundle-manifest -- being a JSON file -- can be imported
// directly without any special handling. This is because both bundlers and
// NodeJS, support JSON imports out of the box.

import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { ManifestItem } from '@atproto-labs/rollup-plugin-bundle-manifest'
// @ts-expect-error: This file is generated at build time
// eslint-disable-next-line import/no-unresolved
import bundleManifest from '../assets/bundle-manifest.json'

// @NOTE Not relying on ManifestItem to describe this type to avoid dependency
// of built code on '@atproto-labs/rollup-plugin-bundle-manifest'.
export type Asset =
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

export const assets = new Map<string, Asset>(
  Object.entries<ManifestItem>(bundleManifest).map(
    ([filename, { data, ...item }]) => {
      const buffer = data ? Buffer.from(data, 'base64') : null
      const stream = buffer
        ? () => Readable.from(buffer)
        : () =>
            // ESM version:
            // createReadStream(new URL(`../assets/${filename}`, import.meta.url))
            // CJS version:
            createReadStream(join(__dirname, '..', 'assets', filename))
      return [filename, { ...item, stream }]
    },
  ),
)
