import express from 'express'
import { MethodSchema, MethodSchemaParam } from '@adxp/xrpc'
import mime from 'mime-types'
import Ajv, { ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import {
  Params,
  HandlerInput,
  HandlerOutput,
  handlerOutput,
  InvalidRequestError,
  InternalServerError,
} from './types'

export const ajv = new Ajv()
addFormats(ajv)

type ReqQuery = typeof express.request['query']
type SchemaParams = MethodSchema['parameters']
export function validateReqParams(
  schema: MethodSchema,
  reqParams: ReqQuery,
): Params {
  const params: Params = {}
  const schemaParams: SchemaParams = schema.parameters || {}

  for (const key of [
    ...new Set(Object.keys(schemaParams).concat(Object.keys(reqParams))),
  ]) {
    const reqParam = reqParams[key]
    const schemaParam = schemaParams[key]

    // valid parameter
    if (!schemaParam) {
      throw new InvalidRequestError(`Unknown parameter: ${key}`)
    }

    // required and default
    let value
    if (typeof reqParam === 'undefined') {
      if (schemaParam.required) {
        throw new InvalidRequestError(`Required parameter not supplied: ${key}`)
      } else if (schemaParam.default) {
        value = schemaParam.default
      } else {
        continue
      }
    }

    // type coersion
    value = coerceParam(schemaParam.type, reqParam)

    // value ranges
    if (schemaParam.type === 'number' || schemaParam.type === 'integer') {
      if (
        typeof schemaParam.maximum === 'number' &&
        value > schemaParam.maximum
      ) {
        throw new InvalidRequestError(
          `Parameter '${key}' is greater than maximum allowed value (${schemaParam.maximum})`,
        )
      }
      if (
        typeof schemaParam.minimum === 'number' &&
        value < schemaParam.minimum
      ) {
        throw new InvalidRequestError(
          `Parameter '${key}' is less than minimum allowed value (${schemaParam.minimum})`,
        )
      }
    } else if (schemaParam.type === 'string') {
      if (
        typeof schemaParam.maxLength === 'number' &&
        value.length > schemaParam.maxLength
      ) {
        throw new InvalidRequestError(
          `Parameter '${key}' is greater than maximum allowed length (${schemaParam.maxLength})`,
        )
      }
      if (
        typeof schemaParam.minLength === 'number' &&
        value.length < schemaParam.minLength
      ) {
        throw new InvalidRequestError(
          `Parameter '${key}' is less than minimum allowed length (${schemaParam.minLength})`,
        )
      }
    }

    // done
    params[key] = value
  }

  return params
}

export function validateInput(
  schema: MethodSchema,
  req: express.Request,
  inputBodyBuf: Uint8Array,
  jsonValidator?: ValidateFunction,
): HandlerInput | undefined {
  // request expectation
  if (inputBodyBuf?.byteLength && !schema.input) {
    throw new InvalidRequestError(
      `A request body was provided when none was expected`,
    )
  }
  if (!inputBodyBuf?.byteLength && schema.input) {
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

  // parse
  const inputBody = parseInputBodyBuf(inputBodyBuf, inputEncoding)

  // json schema
  if (jsonValidator) {
    if (!jsonValidator(inputBody)) {
      throw new InvalidRequestError(ajv.errorsText(jsonValidator.errors))
    }
  }

  return {
    encoding: inputEncoding,
    body: inputBody,
  }
}

export function validateOutput(
  schema: MethodSchema,
  output: HandlerOutput | undefined,
  jsonValidator?: ValidateFunction,
): HandlerOutput | undefined {
  // initial validation
  if (output) {
    handlerOutput.parse(output)
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
      throw new InternalServerError(ajv.errorsText(jsonValidator.errors))
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

export async function readReqBody(req: express.Request): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
  })
}

function isValidEncoding(possible: string | string[], value: string) {
  const normalized = normalizeMime(value)
  if (!normalized) return false
  if (Array.isArray(possible)) {
    return possible.includes(normalized)
  }
  return possible === normalized
}

function parseInputBodyBuf(inputBodyBuf: Uint8Array, encoding: string) {
  if (encoding.startsWith('text/') || encoding === 'application/json') {
    const str = new TextDecoder().decode(inputBodyBuf)
    if (encoding === 'application/json') {
      return JSON.parse(str)
    }
    return str
  }
  return inputBodyBuf
}

function coerceParam(
  type: MethodSchemaParam['type'],
  value: any,
): string | boolean | number {
  if (type === 'string') {
    return String(value)
  } else if (type === 'boolean') {
    return String(value) === 'true'
  } else if (type === 'integer') {
    return parseInt(String(value))
  } else if (type === 'number') {
    return parseFloat(String(value))
  }
  throw new Error(`Unsupported parameter type: ${type}`)
}
