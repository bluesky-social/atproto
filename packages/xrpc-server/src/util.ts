import { Readable, Transform, TransformCallback } from 'stream'
import { createDeflate, createGunzip } from 'zlib'
import express from 'express'
import mime from 'mime-types'
import { Lexicons, LexXrpcProcedure, LexXrpcQuery } from '@atproto/lexicon'
import { forwardStreamErrors } from '@atproto/common'
import {
  UndecodedParams,
  Params,
  HandlerInput,
  HandlerSuccess,
  handlerSuccess,
  InvalidRequestError,
  InternalServerError,
  Options,
  XRPCError,
} from './types'

export function decodeQueryParams(
  def: LexXrpcProcedure | LexXrpcQuery,
  params: UndecodedParams,
): Params {
  const decoded: Params = {}
  for (const k in params) {
    if (def.parameters?.properties?.[k]) {
      decoded[k] = decodeQueryParam(
        def.parameters?.properties[k]?.type,
        params[k],
      )
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
  if (type === 'number') {
    return Number(String(value))
  } else if (type === 'integer') {
    return Number(String(value)) | 0
  } else if (type === 'boolean') {
    return value === 'true'
  }
}

export function validateInput(
  nsid: string,
  def: LexXrpcProcedure | LexXrpcQuery,
  req: express.Request,
  opts: Options,
  lexicons: Lexicons,
): HandlerInput | undefined {
  // request expectation
  const reqHasBody = hasBody(req)
  if (reqHasBody && (def.type !== 'procedure' || !def.input)) {
    throw new InvalidRequestError(
      `A request body was provided when none was expected`,
    )
  }
  if (def.type === 'query') {
    return
  }
  if (!reqHasBody && def.input) {
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
    throw new InvalidRequestError(`Invalid request encoding: ${inputEncoding}`)
  }

  if (!inputEncoding) {
    // no input body
    return undefined
  }

  // if input schema, validate
  if (def.input?.schema) {
    try {
      lexicons.assertValidXrpcInput(nsid, req.body)
    } catch (e) {
      throw new InvalidRequestError(e instanceof Error ? e.message : String(e))
    }
  }

  // if middleware already got the body, we pass that along as input
  // otherwise, we pass along a decoded readable stream
  let body
  if (req.complete) {
    body = req.body
  } else {
    body = decodeBodyStream(req, opts.payload?.blobLimit)
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
): HandlerSuccess | undefined {
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
      lexicons.assertValidXrpcOutput(nsid, output?.body)
    } catch (e) {
      throw new InternalServerError(e instanceof Error ? e.message : String(e))
    }
  }

  return output
}

export function normalizeMime(v: string) {
  const fullType = mime.contentType(v)
  if (!v) return false
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

export function hasBody(req: express.Request) {
  const contentLength = req.headers['content-length']
  const transferEncoding = req.headers['transfer-encoding']
  return (contentLength && parseInt(contentLength, 10) > 0) || transferEncoding
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
  let stream: Readable = req
  const contentEncoding = req.headers['content-encoding']
  const contentLength = req.headers['content-length']

  if (
    maxSize !== undefined &&
    contentLength &&
    parseInt(contentLength, 10) > maxSize
  ) {
    throw new XRPCError(413, 'request entity too large')
  }

  let decoder: Transform | undefined
  if (contentEncoding === 'gzip') {
    decoder = createGunzip()
  } else if (contentEncoding === 'deflate') {
    decoder = createDeflate()
  }

  if (decoder) {
    forwardStreamErrors(stream, decoder)
    stream = stream.pipe(decoder)
  }

  if (maxSize !== undefined) {
    const maxSizeChecker = new MaxSizeChecker(maxSize)
    forwardStreamErrors(stream, maxSizeChecker)
    stream = stream.pipe(maxSizeChecker)
  }

  return stream
}

class MaxSizeChecker extends Transform {
  totalSize = 0
  constructor(public maxSize: number) {
    super()
  }
  _transform(chunk: Uint8Array, _enc: BufferEncoding, cb: TransformCallback) {
    this.totalSize += chunk.length
    if (this.totalSize > this.maxSize) {
      return this.destroy(new XRPCError(413, 'request entity too large'))
    }
    return cb(null, chunk)
  }
}
