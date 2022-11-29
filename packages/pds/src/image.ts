import { Readable, Stream } from 'node:stream'
import sharp, { FormatEnum } from 'sharp'

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

const formatsToMimes: { [s in keyof FormatEnum]?: `image/${string}` } = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}

export interface ImageProcessor {
  resize(stream: Readable, options: Options): Promise<Readable>
  getInfo(stream: Readable): Promise<ImageInfo>
}

export type Options = Dimensions & {
  format: 'jpeg' | 'png'
  // When 'cover', scale to fill given dimensions, cropping if necessary.
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

function forwardStreamErrors(...streams: Stream[]) {
  for (let i = 0; i < streams.length; ++i) {
    const stream = streams[i]
    const next = streams[i + 1]
    if (next) {
      stream.once('error', (err) => next.emit('error', err))
    }
  }
}
