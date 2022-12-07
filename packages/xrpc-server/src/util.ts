import express from 'express'
import { Lexicons, LexXrpcProcedure, LexXrpcQuery } from '@atproto/lexicon'
import mime from 'mime-types'
import {
  UndecodedParams,
  Params,
  HandlerInput,
  HandlerSuccess,
  handlerSuccess,
  InvalidRequestError,
  InternalServerError,
} from './types'
import { cloneStream } from '@atproto/common'

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
  // otherwise, we pipe it into a readable stream
  let body
  if (req.complete) {
    body = req.body
  } else {
    body = cloneStream(req)
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
