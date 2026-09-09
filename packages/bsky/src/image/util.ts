import type { FormatEnum, OutputInfo } from 'sharp'

export type ImageMime = `image/${string}`

export type Options = Dimensions & {
  format: 'jpeg' | 'webp'
  // When 'cover' (default), scale to fill given dimensions, cropping if necessary.
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
  mime: ImageMime | 'unknown'
}

export type Dimensions = { height: number; width: number }

export const formatsToMimes = new Map<keyof FormatEnum, ImageMime>([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['svg', 'image/svg+xml'],
  ['tiff', 'image/tiff'],
  ['webp', 'image/webp'],
  ['heif', 'image/heif'],
  ['jp2', 'image/jp2'],
  ['jxl', 'image/jxl'],
  ['webp', 'image/webp'],
])

export type SharpInfo = OutputInfo & { format: keyof FormatEnum }
