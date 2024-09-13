import { streamToNodeBuffer } from '@atproto/common'
import { Readable } from 'node:stream'

import {
  KnownNames,
  KnownParser,
  KnownTypes,
  parseContentType,
  ParserForType,
  ParserResult,
  parsers,
} from './parser.js'

/**
 * Generic method that parses a stream of unknown nature (HTTP request/response,
 * socket, file, etc.), but of known mime type, into a parsed object.
 *
 * @throws {TypeError} If the content-type is not valid or supported.
 */
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
  const type = parseContentType(contentType)

  const parser = parsers.find(
    (parser) =>
      allow?.includes(parser.name) !== false && parser.test(type.mime),
  )

  if (!parser) {
    throw new TypeError(`Unsupported content-type: ${type.mime}`)
  }

  const buffer = await streamToNodeBuffer(req)
  return parser.parse(buffer, type)
}
