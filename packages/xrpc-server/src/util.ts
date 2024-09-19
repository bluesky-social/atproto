import assert from 'node:assert'
import { Duplex, pipeline, Readable } from 'node:stream'
import { IncomingMessage } from 'node:http'
import express from 'express'
import mime from 'mime-types'
import {
  jsonToLex,
  Lexicons,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
} from '@atproto/lexicon'
import { createDecoders, MaxSizeChecker } from '@atproto/common'
import { ResponseType } from '@atproto/xrpc'

import {
  UndecodedParams,
  Params,
  HandlerInput,
  HandlerSuccess,
  handlerSuccess,
  InvalidRequestError,
  InternalServerError,
  XRPCError,
  RouteOpts,
} from './types'

export function decodeQueryParams(
  def: LexXrpcProcedure | LexXrpcQuery | LexXrpcSubscription,
  params: UndecodedParams,
): Params {
  const decoded: Params = {}
  for (const k in params) {
    const val = params[k]
    const property = def.parameters?.properties?.[k]
    if (property) {
      if (property.type === 'array') {
        const vals: (typeof val)[] = []
        decoded[k] = val
          ? vals
              .concat(val) // Cast to array
              .flatMap((v) => decodeQueryParam(property.items.type, v) ?? [])
          : undefined
      } else {
        decoded[k] = decodeQueryParam(property.type, val)
      }
    }
  }
  return decoded
}

export function decodeQueryParam(
  type: string,
  value: unknown,
): string | number | boolean | undefined {
  if (!value) {
    return undefined
  }
  if (type === 'string' || type === 'datetime') {
    return String(value)
  }
  if (type === 'float') {
    return Number(String(value))
  } else if (type === 'integer') {
    return parseInt(String(value), 10) || 0
  } else if (type === 'boolean') {
    return value === 'true'
  }
}

export function getQueryParams(url = ''): Record<string, string | string[]> {
  const { searchParams } = new URL(url ?? '', 'http://x')
  const result: Record<string, string | string[]> = {}
  for (const key of searchParams.keys()) {
    result[key] = searchParams.getAll(key)
    if (result[key].length === 1) {
      result[key] = result[key][0]
    }
  }
  return result
}

export function validateInput(
  nsid: string,
  def: LexXrpcProcedure | LexXrpcQuery,
  req: express.Request,
  opts: RouteOpts,
  lexicons: Lexicons,
): HandlerInput | undefined {
  // request expectation

  const bodyPresence = getBodyPresence(req)
  if (bodyPresence === 'present' && (def.type !== 'procedure' || !def.input)) {
    throw new InvalidRequestError(
      `A request body was provided when none was expected`,
    )
  }
  if (def.type === 'query') {
    return
  }
  if (bodyPresence === 'missing' && def.input) {
    throw new InvalidRequestError(
      `A request body is expected but none was provided`,
    )
  }

  // mimetype
  const inputEncoding = normalizeMime(req.headers['content-type'] || '')
  if (
    def.input?.encoding &&
    (!inputEncoding || !isValidEncoding(def.input?.encoding, inputEncoding))
  ) {
    if (!inputEncoding) {
      throw new InvalidRequestError(
        `Request encoding (Content-Type) required but not provided`,
      )
    } else {
      throw new InvalidRequestError(
        `Wrong request encoding (Content-Type): ${inputEncoding}`,
      )
    }
  }

  if (!inputEncoding) {
    // no input body
    return undefined
  }

  // if input schema, validate
  if (def.input?.schema) {
    try {
      const lexBody = req.body ? jsonToLex(req.body) : req.body
      req.body = lexicons.assertValidXrpcInput(nsid, lexBody)
    } catch (e) {
      throw new InvalidRequestError(e instanceof Error ? e.message : String(e))
    }
  }

  // if middleware already got the body, we pass that along as input
  // otherwise, we pass along a decoded readable stream
  let body
  if (req.readableEnded) {
    body = req.body
  } else {
    body = decodeBodyStream(req, opts.blobLimit)
  }

  return {
    encoding: inputEncoding,
    body,
  }
}

export function validateOutput(
  nsid: string,
  def: LexXrpcProcedure | LexXrpcQuery,
  output: HandlerSuccess | undefined,
  lexicons: Lexicons,
): void {
  // initial validation
  if (output) {
    handlerSuccess.parse(output)
  }

  // response expectation
  if (output?.body && !def.output) {
    throw new InternalServerError(
      `A response body was provided when none was expected`,
    )
  }
  if (!output?.body && def.output) {
    throw new InternalServerError(
      `A response body is expected but none was provided`,
    )
  }

  // mimetype
  if (
    def.output?.encoding &&
    (!output?.encoding ||
      !isValidEncoding(def.output?.encoding, output?.encoding))
  ) {
    throw new InternalServerError(
      `Invalid response encoding: ${output?.encoding}`,
    )
  }

  // output schema
  if (def.output?.schema) {
    try {
      const result = lexicons.assertValidXrpcOutput(nsid, output?.body)
      if (output) {
        output.body = result
      }
    } catch (e) {
      throw new InternalServerError(e instanceof Error ? e.message : String(e))
    }
  }
}

export function normalizeMime(v: string) {
  if (!v) return false
  const fullType = mime.contentType(v)
  if (!fullType) return false
  const shortType = fullType.split(';')[0]
  if (!shortType) return false
  return shortType
}

function isValidEncoding(possibleStr: string, value: string) {
  const possible = possibleStr.split(',').map((v) => v.trim())
  const normalized = normalizeMime(value)
  if (!normalized) return false
  if (possible.includes('*/*')) return true
  return possible.includes(normalized)
}

type BodyPresence = 'missing' | 'empty' | 'present'

function getBodyPresence(req: express.Request): BodyPresence {
  if (req.headers['transfer-encoding'] != null) return 'present'
  if (req.headers['content-length'] === '0') return 'empty'
  if (req.headers['content-length'] != null) return 'present'
  return 'missing'
}

export function processBodyAsBytes(req: express.Request): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
  })
}

function decodeBodyStream(
  req: express.Request,
  maxSize: number | undefined,
): Readable {
  const contentEncoding = req.headers['content-encoding']
  const contentLength = req.headers['content-length']

  const contentLengthParsed = contentLength
    ? parseInt(contentLength, 10)
    : undefined

  if (Number.isNaN(contentLengthParsed)) {
    throw new XRPCError(ResponseType.InvalidRequest, 'invalid content-length')
  }

  if (
    maxSize !== undefined &&
    contentLengthParsed !== undefined &&
    contentLengthParsed > maxSize
  ) {
    throw new XRPCError(
      ResponseType.PayloadTooLarge,
      'request entity too large',
    )
  }

  let transforms: Duplex[]
  try {
    transforms = createDecoders(contentEncoding)
  } catch (cause) {
    throw new XRPCError(
      ResponseType.UnsupportedMediaType,
      'unsupported content-encoding',
      undefined,
      { cause },
    )
  }

  if (maxSize !== undefined) {
    const maxSizeChecker = new MaxSizeChecker(
      maxSize,
      () =>
        new XRPCError(ResponseType.PayloadTooLarge, 'request entity too large'),
    )
    transforms.push(maxSizeChecker)
  }

  return transforms.length > 0
    ? (pipeline([req, ...transforms], () => {}) as Duplex)
    : req
}

export function serverTimingHeader(timings: ServerTiming[]) {
  return timings
    .map((timing) => {
      let header = timing.name
      if (timing.duration) header += `;dur=${timing.duration}`
      if (timing.description) header += `;desc="${timing.description}"`
      return header
    })
    .join(', ')
}

export class ServerTimer implements ServerTiming {
  public duration?: number
  private startMs?: number
  constructor(
    public name: string,
    public description?: string,
  ) {}
  start() {
    this.startMs = Date.now()
    return this
  }
  stop() {
    assert(this.startMs, "timer hasn't been started")
    this.duration = Date.now() - this.startMs
    return this
  }
}

export interface ServerTiming {
  name: string
  duration?: number
  description?: string
}

export const parseReqNsid = (req: express.Request | IncomingMessage) =>
  parseUrlNsid('originalUrl' in req ? req.originalUrl : req.url || '/')

/**
 * Validates and extracts the nsid from an xrpc path
 */
export const parseUrlNsid = (url: string): string => {
  // /!\ Hot path

  if (
    // Ordered by likelihood of failure
    url.length <= 6 ||
    url[5] !== '/' ||
    url[4] !== 'c' ||
    url[3] !== 'p' ||
    url[2] !== 'r' ||
    url[1] !== 'x' ||
    url[0] !== '/'
  ) {
    throw new InvalidRequestError('invalid xrpc path')
  }

  const startOfNsid = 6

  let curr = startOfNsid
  let char: number
  let alphaNumRequired = true
  for (; curr < url.length; curr++) {
    char = url.charCodeAt(curr)
    if (
      (char >= 48 && char <= 57) || // 0-9
      (char >= 65 && char <= 90) || // A-Z
      (char >= 97 && char <= 122) // a-z
    ) {
      alphaNumRequired = false
    } else if (char === 45 /* "-" */ || char === 46 /* "." */) {
      if (alphaNumRequired) {
        throw new InvalidRequestError('invalid xrpc path')
      }
      alphaNumRequired = true
    } else if (char === 47 /* "/" */) {
      // Allow trailing slash (next char is either EOS or "?")
      if (curr === url.length - 1 || url.charCodeAt(curr + 1) === 63) {
        break
      }
      throw new InvalidRequestError('invalid xrpc path')
    } else if (char === 63 /* "?"" */) {
      break
    } else {
      throw new InvalidRequestError('invalid xrpc path')
    }
  }

  // last char was one of: '-', '.', '/'
  if (alphaNumRequired) {
    throw new InvalidRequestError('invalid xrpc path')
  }

  // A domain name consists of minimum two characters
  if (curr - startOfNsid < 2) {
    throw new InvalidRequestError('invalid xrpc path')
  }

  // @TODO is there a max ?

  return url.slice(startOfNsid, curr)
}
