import type { IncomingMessage } from 'node:http'
import { type Duplex, type Readable, pipeline } from 'node:stream'
import createHttpError from 'http-errors'
import {
  MaxSizeChecker,
  createDecoders,
  streamToNodeBuffer,
} from '@atproto/common'
import {
  type KnownNames,
  type KnownParser,
  type ParserResult,
  parseContentType,
  parsers,
} from './parser.js'

/**
 * Bounds the decoded request body, whichever content-encoding it arrived with.
 * The payloads these routes legitimately carry are single-digit kilobytes, so
 * this leaves ample headroom.
 */
export const DEFAULT_MAX_BODY_SIZE = 100 * 1024 // 100 KiB

export function decodeHttpRequest(
  req: IncomingMessage,
  maxSize: number,
): Readable {
  // @NOTE Content-Length counts the octets actually transferred, i.e. the
  // body *after* content-encoding. It therefore bounds the wire size, which
  // the MaxSizeChecker below does not (that one bounds the decoded size);
  // these are two distinct bounds that happen to share a constant. It is not
  // a substitute for the checker: the header is absent under chunked transfer
  // encoding, and a client may understate it.
  const contentLength = req.headers['content-length']
  if (contentLength != null) {
    const size = Number(contentLength)
    if (!Number.isInteger(size) || size < 0) {
      throw createHttpError(400, 'Invalid content-length')
    }
    if (size > maxSize) {
      throw createHttpError(413, 'Payload too large')
    }
  }

  try {
    // @NOTE The checker is applied even when the body is not encoded: nothing
    // else bounds the size of these requests.
    return pipeline(
      [
        req,
        ...createDecoders(req.headers['content-encoding']),
        new MaxSizeChecker(maxSize, () =>
          createHttpError(413, 'Payload too large'),
        ),
      ],
      () => {},
    ) as Duplex
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
  maxSize: number = DEFAULT_MAX_BODY_SIZE,
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

  const stream = decodeHttpRequest(req, maxSize)
  const buffer = await streamToNodeBuffer(stream)
  return parser.parse(buffer, type) as ParserResult<
    Extract<KnownParser, { name: A[number] }>
  >
}

export async function flushStream(stream: AsyncIterable<any>): Promise<void> {
  for await (const _ of stream) {
    // Consume the stream to completion
  }
}
