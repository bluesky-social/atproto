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
    return stream
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
