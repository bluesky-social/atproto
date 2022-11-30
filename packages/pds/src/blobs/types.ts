import express from 'express'
import multer from 'multer'
import { CID } from 'multiformats/cid'

// --------------------------
// NOTE: THIS FILE IS JUST ME SKETCHING A FEW THINGS OUT
// --------------------------

interface BlobProcessor {
  storage: multer.StorageEngine
  makeFiles(req: express.Request): Record<string, File>
}

type File = Image | Blob

interface Blob {
  name: string
  mimeType: string
  getBytes(): Promise<Uint8Array>
  getCid(): Promise<CID>
  moveToCarStore(did: string): Promise<CID>
}

interface Image extends Blob {
  resize(options: ImageOptions): Promise<Image>
  getInfo(): Promise<ImageInfo>
}

export type ImageOptions = Dimensions & {
  format: 'jpeg' | 'png'
  // When 'cover', scale to fill given dimensions, cropping if necessary.
  // When 'inside', scale to fit within given dimensions.
  fit?: 'cover' | 'inside'
  // When false (default), do not scale up.
  // When true, scale up to hit dimensions given in options.
  // Otherwise, scale up to hit specified min dimensions.
  min?: Dimensions | boolean
  // A number 1-100
  quality?: number
}

export type ImageInfo = Dimensions & {
  size: number
  mime: `image/${string}` | 'unknown'
}

export type Dimensions = { height: number; width: number }
