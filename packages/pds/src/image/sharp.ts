import { Readable } from 'stream'
import sharp from 'sharp'
import {
  formatsToMimes,
  forwardStreamErrors,
  ImageProcessor,
  Options,
} from './util'

export class SharpImageProcessor implements ImageProcessor {
  async resize(stream: Readable, options: Options) {
    const {
      height,
      width,
      min = false,
      fit = 'cover',
      format,
      quality,
    } = options

    let processor = sharp()

    // Scale up to hit any specified minimum size
    if (typeof min !== 'boolean') {
      processor = processor.resize({
        fit: 'cover',
        width: min.width,
        height: min.height,
        withoutReduction: true,
        withoutEnlargement: false,
      })
    }

    // Scale down (or possibly up if min is false) to desired size
    processor = processor.resize({
      fit,
      width,
      height,
      withoutEnlargement: min === false,
    })

    // Output to specified format
    if (format === 'jpeg') {
      processor = processor.jpeg({ quality: quality ?? 80 })
    } else if (format === 'png') {
      const compressionLevel =
        typeof quality === 'number' ? Math.round((9 * quality) / 100) : 6
      processor = processor.png({ compressionLevel })
    }

    forwardStreamErrors(stream, processor)
    return stream.pipe(processor)
  }

  async getInfo(stream: Readable) {
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
}
