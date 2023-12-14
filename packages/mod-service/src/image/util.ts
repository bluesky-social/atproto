import { FormatEnum } from 'sharp'

export type Options = Dimensions & {
  format: 'jpeg' | 'png'
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
  mime: `image/${string}` | 'unknown'
}

export type Dimensions = { height: number; width: number }

export const formatsToMimes: { [s in keyof FormatEnum]?: `image/${string}` } = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}
