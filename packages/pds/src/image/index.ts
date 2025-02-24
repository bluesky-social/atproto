import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import sharp from 'sharp'
import { errHasMsg } from '@atproto/common'

export async function maybeGetInfo(
  stream: Readable,
): Promise<ImageInfo | null> {
  let metadata: sharp.Metadata
  try {
    const processor = sharp()
    const [result] = await Promise.all([
      processor.metadata(),
      pipeline(stream, processor), // Handles error propagation
    ])
    metadata = result
  } catch (err) {
    if (errHasMsg(err, 'Input buffer contains unsupported image format')) {
      return null
    }
    throw err
  }
  const { size, height, width, format } = metadata
  if (
    size === undefined ||
    height === undefined ||
    width === undefined ||
    format === undefined
  ) {
    return null
  }

  return {
    height,
    width,
    size,
    mime: formatsToMimes[format] ?? ('unknown' as const),
  }
}

export async function getInfo(stream: Readable): Promise<ImageInfo> {
  const maybeInfo = await maybeGetInfo(stream)
  if (!maybeInfo) {
    throw new Error('could not obtain all image metadata')
  }
  return maybeInfo
}

export type Dimensions = { height: number; width: number }

export type ImageInfo = Dimensions & {
  size: number
  mime: `image/${string}` | 'unknown'
}

export const formatsToMimes: {
  [s in keyof sharp.FormatEnum]?: `image/${string}`
} = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}
