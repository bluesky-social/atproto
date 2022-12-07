import { Readable } from 'stream'
import sharp from 'sharp'
import { forwardStreamErrors } from '@atproto/common'
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
    processor = processor.jpeg({ quality: quality ?? 80 })
  } else if (format === 'png') {
    processor = processor.png({ quality: quality ?? 100 })
  }

  forwardStreamErrors(stream, processor)
  return stream.pipe(processor)
}

export async function getInfo(stream: Readable): Promise<ImageInfo> {
  const processor = sharp()

  forwardStreamErrors(stream, processor)
  const { size, height, width, format } = await stream
    .pipe(processor)
    .metadata()

  if (
    size === undefined ||
    height === undefined ||
    width === undefined ||
    format === undefined
  ) {
    throw new Error('could not obtain all image metadata')
  }

  return {
    height,
    width,
    size,
    mime: formatsToMimes[format] ?? ('unknown' as const),
  }
}
