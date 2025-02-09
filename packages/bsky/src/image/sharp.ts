import { PassThrough, Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import sharp from 'sharp'
import { errHasMsg } from '@atproto/common'
import { ImageInfo, Options, formatsToMimes } from './util'

export type { Options }

/**
 * Scale up to hit any specified minimum size
 */
export function createImageUpscaler({ min = false }: Options) {
  // Due to the way sharp works, up-scaling must happen in a separate processor
  // than down-scaling.
  return typeof min !== 'boolean'
    ? sharp().resize({
        fit: 'outside',
        width: min.width,
        height: min.height,
        withoutReduction: true,
        withoutEnlargement: false,
      })
    : new PassThrough()
}

/**
 * Scale down (or possibly up if min is true) to desired size, then compress
 * to the desired format.
 */
export function createImageProcessor({
  height,
  width,
  min = false,
  fit = 'cover',
  format,
  quality = 100,
}: Options) {
  const processor = sharp().resize({
    fit,
    width,
    height,
    withoutEnlargement: min !== true,
  })

  if (format === 'jpeg') {
    return processor.jpeg({ quality })
  } else if (format === 'png') {
    return processor.png({ quality })
  } else {
    throw new Error(`Unhandled case: ${format}`)
  }
}

export async function maybeGetInfo(
  stream: Readable,
): Promise<ImageInfo | null> {
  try {
    const processor = sharp()

    const [{ size, height, width, format }] = await Promise.all([
      processor.metadata(),
      pipeline(stream, processor), // Handles error propagation
    ])

    if (size == null || height == null || width == null || format == null) {
      return null
    }

    return {
      height,
      width,
      size,
      mime: formatsToMimes.get(format) ?? 'unknown',
    }
  } catch (err) {
    if (errHasMsg(err, 'Input buffer contains unsupported image format')) {
      return null
    }
    throw err
  }
}

export async function getInfo(stream: Readable): Promise<ImageInfo> {
  const maybeInfo = await maybeGetInfo(stream)
  if (!maybeInfo) {
    throw new Error('could not obtain all image metadata')
  }
  return maybeInfo
}
