import express from 'express'
import { MethodSchema } from '@atproto/lexicon'
import mime from 'mime-types'
import multer from 'multer'
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

export async function validateInput(
  schema: MethodSchema,
  req: express.Request,
  res: express.Response,
  jsonValidator?: ValidateFunction,
): Promise<HandlerInput | undefined> {
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

  // json/text/raw is handled by middleware, we explicitly handle multiparts
  if (inputEncoding === 'multipart/form-data') {
    const expectedFiles = expectedFilesFromSchema(schema.input?.schema)
    await handleMultipart(expectedFiles, req, res)
    const uploadedFiles = Object.keys(req.files || {})
    const requiredFiles = expectedFiles.filter(
      (name) => schema.input?.schema.required.indexOf(name) > -1,
    )
    const missing = requiredFiles.filter(
      (name) => uploadedFiles.indexOf(name) < 0,
    )
    if (missing.length > 0) {
      throw new InvalidRequestError(`Missing expected blob upload: ${missing}`)
    }
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

async function handleMultipart(
  expectedFiles: string[],
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const files = expectedFiles.map((name) => ({ name, maxCount: 1 }))
  return new Promise((resolve, reject) => {
    multer().fields(files)(req, res, (err) => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
}

function expectedFilesFromSchema(schema: Record<string, any>): string[] {
  const properties = schema.properties
  const filenames: string[] = []
  for (const key of Object.keys(properties)) {
    if (properties[key].type === 'blob') {
      filenames.push(key)
    }
  }
  return filenames
}

export function removeBlobsFromSchema(schema: Record<string, any>) {
  const propertiesNoBlobs = {}
  const requiredNoBlobs: string[] = []
  for (const [key, val] of Object.entries(schema.properties)) {
    if ((val as any).type !== 'blob') {
      propertiesNoBlobs[key] = val
      if (schema.required.indexOf(key) > -1) {
        requiredNoBlobs.push(key)
      }
    }
  }
  return {
    ...schema,
    required: requiredNoBlobs,
    properties: propertiesNoBlobs,
  }
}
