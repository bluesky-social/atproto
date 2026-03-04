import { FormatEnum, OutputInfo } from 'sharp'

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
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['svg', 'image/svg+xml'],
  ['tif', 'image/tiff'],
  ['tiff', 'image/tiff'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
  ['heif', 'image/heif'],
  ['jp2', 'image/jp2'],
  ['jxl', 'image/jxl'],
  ['webp', 'image/webp'],
])

export type SharpInfo = OutputInfo & { format: keyof FormatEnum }

/**
 * Values 0 through 16. Permissively typed.
 */
export type IncludeFormatLevel = number

/**
 * Determines based on cid and level whether to include the image format in the URL
 */
export function shouldIncludeFormat(cid: string, level: IncludeFormatLevel) {
  if (level === 0) return false
  if (level === 16) return true
  // CIDs are random hashes in base32: a-z2-7
  // We take the char at the end because CIDs have a prefix
  const ch = cid.at(-1)
  if (level >= 1 && (ch === 'a' || ch === 'b')) return true
  if (level >= 2 && (ch === 'c' || ch === 'd')) return true
  if (level >= 3 && (ch === 'e' || ch === 'f')) return true
  if (level >= 4 && (ch === 'g' || ch === 'h')) return true
  if (level >= 5 && (ch === 'i' || ch === 'j')) return true
  if (level >= 6 && (ch === 'k' || ch === 'l')) return true
  if (level >= 7 && (ch === 'm' || ch === 'n')) return true
  if (level >= 8 && (ch === 'o' || ch === 'p')) return true
  if (level >= 9 && (ch === 'q' || ch === 'r')) return true
  if (level >= 10 && (ch === 's' || ch === 't')) return true
  if (level >= 11 && (ch === 'u' || ch === 'v')) return true
  if (level >= 12 && (ch === 'w' || ch === 'x')) return true
  if (level >= 13 && (ch === 'y' || ch === 'z')) return true
  if (level >= 14 && (ch === '2' || ch === '3')) return true
  if (level >= 15 && (ch === '4' || ch === '5')) return true
  return false
}
