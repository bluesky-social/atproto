import { decodeStream, streamToNodeBuffer } from '@atproto/common'
import createHttpError from 'http-errors'
import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'

import {
  KnownNames,
  KnownParser,
  parseContentType,
  ParserResult,
  parsers,
} from './parser.js'

export function decodeHttpRequest(req: IncomingMessage): Readable {
  try {
    return decodeStream(req, req.headers['content-encoding'])
  } catch (cause) {
    const message =
      cause instanceof TypeError ? cause.message : `Invalid content-encoding`
    throw createHttpError(415, message, { cause })
  }
}

/**
 * Generic method that parses a stream of unknown nature (HTTP request/response,
 * socket, file, etc.), but of known mime type, into a parsed object.
 *
 * @throws {TypeError} If the content-type is not valid or supported.
 */

export async function parseHttpRequest<A extends readonly KnownNames[]>(
  req: IncomingMessage,
  allow: A,
) {
  const type = parseContentType(
    req.headers['content-type'] ?? 'application/octet-stream',
  )

  const parser = parsers.find(
    (parser) => allow.includes(parser.name) && parser.test(type.mime),
  )

  if (!parser) {
    throw createHttpError(415, `Unsupported content-type: ${type.mime}`)
  }

  const stream = decodeHttpRequest(req)
  const buffer = await streamToNodeBuffer(stream)
  return parser.parse(buffer, type) as ParserResult<
    Extract<KnownParser, { name: A[number] }>
  >
}
