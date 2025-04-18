import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import mime from 'mime'
import type { Plugin } from 'rollup'

type AssetItem = {
  type: 'asset'
  mime?: string
  sha256: string
  data?: string
}

type ChunkItem = {
  type: 'chunk'
  mime: string
  sha256: string
  dynamicImports: string[]
  isDynamicEntry: boolean
  isEntry: boolean
  isImplicitEntry: boolean
  name: string
  data?: string
}

export type ManifestItem = AssetItem | ChunkItem

export type Manifest = Record<string, ManifestItem>

export function bundleManifest({
  name = 'bundle-manifest.json',
  data = false,
}: {
  name?: string
  data?: boolean
} = {}): Plugin<never> {
  return {
    name: 'bundle-manifest',
    generateBundle(outputOptions, bundle) {
      const manifest: Manifest = {}

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset') {
          manifest[fileName] = {
            type: chunk.type,
            data: data
              ? Buffer.from(chunk.source).toString('base64')
              : undefined,
            mime: mime.getType(extname(fileName)) || undefined,
            sha256: createHash('sha256').update(chunk.source).digest('base64'),
          }
        }

        if (chunk.type === 'chunk') {
          manifest[fileName] = {
            type: chunk.type,
            data: data ? Buffer.from(chunk.code).toString('base64') : undefined,
            mime: 'application/javascript',
            sha256: createHash('sha256').update(chunk.code).digest('base64'),
            dynamicImports: chunk.dynamicImports,
            isDynamicEntry: chunk.isDynamicEntry,
            isEntry: chunk.isEntry,
            isImplicitEntry: chunk.isImplicitEntry,
            name: chunk.name,
          }
        }
      }

      this.emitFile({
        type: 'asset',
        fileName: name,
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }
}
