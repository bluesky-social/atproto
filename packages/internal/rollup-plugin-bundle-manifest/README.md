# @atproto-labs/rollup-plugin-bundle-manifest

This Rollup plugin allows to generate a (JSON) manifest containing the output
files of a Rollup build. The manifest will look as follows:

```json
{
  "main.js": {
    "type": "chunk",
    "mime": "application/javascript",
    "dynamicImports": [],
    "isDynamicEntry": false,
    "isEntry": true,
    "isImplicitEntry": false,
    "name": "main",
    "sha256": "<sha256-hash>",
    "data": "<base64-encoded-contents>"
  },
  "main.js.map": {
    "type": "asset",
    "mime": "application/json",
    "sha256": "<sha256-hash>",
    "data": "<base64-encoded-contents>"
  },
  "main.css": {
    "type": "asset",
    "mime": "text/css",
    "sha256": "<sha256-hash>",
    "data": "<base64-encoded-contents>"
  }
  // ... more entries as needed
}
```

This manifest will typically be useful for a backend service that serves the
frontend assets, as it can be used to determine the correct `Content-Type` and
and file integrity (via the SHA-256 hash), without having to read the files
themselves.

## Usage

```js
// rollup.config.js

import bundleManifest from '@atproto-labs/rollup-plugin-bundle-manifest'

export default {
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'es',
  },
  plugins: [
    bundleManifest({
      name: 'bundle-manifest.json',

      // Optional: should the asset data be embedded (as base64 string) in the manifest?
      data: false,
    }),
  ],
}
```

## Options

- `name` (string): The name of the manifest file. Defaults to `bundle-manifest.json`.
- `data` (boolean): Whether to embed the asset data in the manifest. Defaults to `false`.

## Example

```js
const assetManifest = require('./dist/bundle-manifest.json')

const app = express()

app.use((req, res, next) => {
  const asset = assetManifest[req.path.slice(1)]
  if (!asset) return next()

  res.setHeader('Content-Type', asset.mime)
  res.setHeader('Content-Length', asset.data.length)

  res.end(Buffer.from(asset.data, 'base64'))
})

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    buildCSP(assetManifest), // Not provided here
  )

  // Serve the index.html file
  res.sendFile('index.html')
})
```

## License

MIT
