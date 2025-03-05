import type { Readable } from 'node:stream'

export type Asset = {
  url: string
  type?: string
  immutable: boolean
  sha256: string
  createStream: () => Readable
}
