import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import sharp from 'sharp'
import { errHasMsg } from '@atproto/common'
import { formatsToMimes, ImageInfo, Options } from './util'

export type { Options }

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
