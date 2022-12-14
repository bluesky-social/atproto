import { FormatEnum } from 'sharp'

export type Options = Dimensions & {
  format: 'jpeg' | 'png'
  // When 'cover' (default), scale to fill given dimensions, cropping if necessary.
  // When 'contain', preserving aspect ratio, contain within both provided dimensions using "letterboxing" where necessary.
  // When 'inside', preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to both those specified.
  // When 'outside', preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to both those specified.
  fit?: 'cover' | 'contain' | 'inside' | 'outside'
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
