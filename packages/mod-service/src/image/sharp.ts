import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import sharp from 'sharp'
import { errHasMsg, forwardStreamErrors } from '@atproto/common'
import { formatsToMimes, ImageInfo, Options } from './util'

export type { Options }

export async function resize(
  stream: Readable,
  options: Options,
): Promise<Readable> {
  const { height, width, min = false, fit = 'cover', format, quality } = options

  let processor = sharp()

  // Scale up to hit any specified minimum size
  if (typeof min !== 'boolean') {
    const upsizeProcessor = sharp().resize({
      fit: 'outside',
      width: min.width,
      height: min.height,
      withoutReduction: true,
      withoutEnlargement: false,
    })
    forwardStreamErrors(stream, upsizeProcessor)
    stream = stream.pipe(upsizeProcessor)
  }

  // Scale down (or possibly up if min is true) to desired size
  processor = processor.resize({
    fit,
    width,
    height,
    withoutEnlargement: min !== true,
  })

  // Output to specified format
  if (format === 'jpeg') {
    processor = processor.jpeg({ quality: quality ?? 100 })
  } else if (format === 'png') {
    processor = processor.png({ quality: quality ?? 100 })
  } else {
    const exhaustiveCheck: never = format
    throw new Error(`Unhandled case: ${exhaustiveCheck}`)
  }

  forwardStreamErrors(stream, processor)
  return stream.pipe(processor)
}

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
