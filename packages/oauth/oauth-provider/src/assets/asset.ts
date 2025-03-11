import type { Readable } from 'node:stream'
import type { ManifestItem } from '@atproto-labs/rollup-plugin-bundle-manifest'

export type Asset = {
  url: string
  item: ManifestItem
  createStream: () => Readable
}
