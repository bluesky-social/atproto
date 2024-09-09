import { Duplex, Readable } from 'node:stream'
import * as zlib from 'node:zlib'

import createHttpError from 'http-errors'

import {
  KnownNames,
  KnownParser,
  KnownTypes,
  parseContentType,
  ParserForType,
  ParserResult,
  parsers,
} from './parser.js'

export async function readStream(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  let totalLength = 0
  for await (const chunk of readable) {
    chunks.push(chunk)
    totalLength += chunk.length
  }
  return Buffer.concat(chunks, totalLength)
}

export function createDecoder(coding: string): Duplex | null {
  // https://www.rfc-editor.org/rfc/rfc7231#section-3.1.2.1
  // "All content-coding values are case-insensitive..."
  switch (coding.toLowerCase().trim()) {
    // https://www.rfc-editor.org/rfc/rfc9112.html#section-7.2
    case 'gzip':
    case 'x-gzip':
      return zlib.createGunzip({
        // using Z_SYNC_FLUSH (cURL default) to be less strict when decoding
        flush: zlib.constants.Z_SYNC_FLUSH,
        finishFlush: zlib.constants.Z_SYNC_FLUSH,
      })
    case 'deflate':
      return zlib.createInflate()
    case 'br':
      return zlib.createBrotliDecompress()
    case 'identity':
      return null // new PassThrough()
    default:
      throw createHttpError(415, 'Unsupported content-encoding')
  }
}

export function createDecoders(contentEncoding?: string): Duplex[] {
  if (!contentEncoding) return []
  return contentEncoding
    .split(',')
    .map(createDecoder)
    .filter(Boolean as unknown as <T>(x: T) => x is NonNullable<T>)
}

export function decodeStream(
  readable: Readable,
  contentEncoding?: string,
): Readable {
  const decoders = createDecoders(contentEncoding)
  if (decoders.length === 0) return readable
  // @ts-expect-error
  return pipeline(readable, ...decoders, () => {})
}

export async function parseStream<
  T extends KnownTypes,
  A extends readonly KnownNames[] = readonly KnownNames[],
>(
  req: Readable,
  contentType: T,
  allow?: A,
): Promise<
  ParserResult<ParserForType<Extract<KnownParser, { name: A[number] }>, T>>
>
export async function parseStream<
  A extends readonly KnownNames[] = readonly KnownNames[],
>(
  req: Readable,
  contentType: unknown,
  allow?: A,
): Promise<ParserResult<Extract<KnownParser, { name: A[number] }>>>
export async function parseStream(
  req: Readable,
  contentType: unknown = 'application/octet-stream',
  allow?: string[],
): Promise<ParserResult<KnownParser>> {
  if (typeof contentType !== 'string') {
    throw createHttpError(400, 'Invalid content-type')
  }

  const type = parseContentType(contentType)

  const parser = parsers.find(
    (parser) =>
      allow?.includes(parser.name) !== false && parser.test(type.mime),
  )

  if (!parser) {
    throw createHttpError(400, 'Unsupported content-type')
  }

  const buffer = await readStream(req)
  return parser.parse(buffer, type)
}
