import { PassThrough, Readable } from 'node:stream'
import { createGunzip, createInflate } from 'node:zlib'

import createHttpError from 'http-errors'

import {
  KnownNames,
  KnownParser,
  KnownTypes,
  ParserForType,
  ParserResult,
  parsers,
} from './parser.js'

export async function readStream(req: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  let totalLength = 0
  for await (const chunk of req) {
    chunks.push(chunk)
    totalLength += chunk.length
  }
  return Buffer.concat(chunks, totalLength)
}

export function decodeStream(
  req: Readable,
  encoding: string = 'identity',
): Readable {
  switch (encoding) {
    case 'deflate':
      return req.compose(createInflate())
    case 'gzip':
      return req.compose(createGunzip())
    case 'identity':
      return req.compose(new PassThrough())
    default:
      throw createHttpError(415, 'Unsupported content-encoding')
  }
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

  const parser = parsers.find(
    (parser) =>
      allow?.includes(parser.name) !== false && parser.test(contentType),
  )

  if (!parser) {
    throw createHttpError(400, 'Unsupported content-type')
  }

  const buffer = await readStream(req)
  return parser.parse(buffer)
}
