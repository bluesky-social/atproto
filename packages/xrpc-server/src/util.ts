import express from 'express'
import { MethodSchema } from '@atproto/lexicon'
import mime from 'mime-types'
import Ajv, { ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import {
  Params,
  HandlerInput,
  HandlerSuccess,
  handlerSuccess,
  InvalidRequestError,
  InternalServerError,
} from './types'

export const ajv = new Ajv({ useDefaults: true })
addFormats(ajv)

export const paramsAjv = new Ajv({ useDefaults: 'empty', coerceTypes: true })
addFormats(paramsAjv)

type ReqQuery = typeof express.request['query']

export function validateReqParams(
  reqParams: ReqQuery,
  jsonValidator?: ValidateFunction,
): Params {
  if (jsonValidator) {
    if (!jsonValidator(reqParams)) {
      throw new InvalidRequestError(
        paramsAjv.errorsText(jsonValidator.errors, {
          dataVar: 'parameters',
        }),
      )
    }
  }
  return reqParams
}

export function validateInput(
  schema: MethodSchema,
  req: express.Request,
  jsonValidator?: ValidateFunction,
): HandlerInput | undefined {
  // request expectation
  const reqHasBody = hasBody(req)
  if (reqHasBody && !schema.input) {
    throw new InvalidRequestError(
      `A request body was provided when none was expected`,
    )
  }
  if (!reqHasBody && schema.input) {
    throw new InvalidRequestError(
      `A request body is expected but none was provided`,
    )
  }

  // mimetype
  const inputEncoding = normalizeMime(req.headers['content-type'] || '')
  if (
    schema.input?.encoding &&
    (!inputEncoding || !isValidEncoding(schema.input?.encoding, inputEncoding))
  ) {
    throw new InvalidRequestError(`Invalid request encoding: ${inputEncoding}`)
  }

  if (!inputEncoding) {
    // no input body
    return undefined
  }

  // json schema
  if (jsonValidator) {
    if (!jsonValidator(req.body)) {
      throw new InvalidRequestError(
        ajv.errorsText(jsonValidator.errors, {
          dataVar: 'input',
        }),
      )
    }
  }

  return {
    encoding: inputEncoding,
    body: req.body,
  }
}

export function validateOutput(
  schema: MethodSchema,
  output: HandlerSuccess | undefined,
  jsonValidator?: ValidateFunction,
): HandlerSuccess | undefined {
  // initial validation
  if (output) {
    handlerSuccess.parse(output)
  }

  // response expectation
  if (output?.body && !schema.output) {
    throw new InternalServerError(
      `A response body was provided when none was expected`,
    )
  }
  if (!output?.body && schema.output) {
    throw new InternalServerError(
      `A response body is expected but none was provided`,
    )
  }

  // mimetype
  if (
    schema.output?.encoding &&
    (!output?.encoding ||
      !isValidEncoding(schema.output?.encoding, output?.encoding))
  ) {
    throw new InternalServerError(
      `Invalid response encoding: ${output?.encoding}`,
    )
  }

  // json schema
  if (jsonValidator) {
    if (!jsonValidator(output?.body)) {
      throw new InternalServerError(
        ajv.errorsText(jsonValidator.errors, {
          dataVar: 'output',
        }),
      )
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

function isValidEncoding(possible: string | string[], value: string) {
  const normalized = normalizeMime(value)
  if (!normalized) return false
  if (Array.isArray(possible)) {
    return possible.includes(normalized)
  }
  return possible === normalized
}

function hasBody(req: express.Request) {
  const contentLength = req.headers['content-length']
  const transferEncoding = req.headers['transfer-encoding']
  return (contentLength && parseInt(contentLength, 10) > 0) || transferEncoding
}
