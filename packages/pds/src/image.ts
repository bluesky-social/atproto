export interface ImageProcessor {
  resize(stream: ReadableStream, options: Options): Promise<ReadableStream>
  getInfo(stream: ReadableStream): ImageInfo
}

export type Options = Dimensions & {
  // When 'cover', scale to fill given dimensions, cropping if necessary.
  // When 'inside', scale to fit within given dimensions.
  fit?: 'cover' | 'inside'
  // When false (default), do not scale up.
  // When true, scale up to hit dimensions given in options.
  // Otherwise, scale up to hit specified min dimensions.
  min?: Dimensions | boolean
}

export type ImageInfo = Dimensions & {
  mime: `image/${string}`
  sizeBytes: number
}

export type Dimensions = { height: number; width: number }
