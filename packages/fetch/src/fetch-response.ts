import { Transformer, compose } from '@atproto/transformer'
import { z } from 'zod'

import { FetchError, FetchErrorOptions } from './fetch-error.js'
import { Json, ifObject, ifString } from './util.js'
import { TransformedResponse } from './transformed-response.js'

export type ResponseTranformer = Transformer<Response>

async function extractResponseMessage(
  headers: Headers,
  body?: Blob | null,
): Promise<string | undefined> {
  if (!body) return undefined

  const contentType = headers.get('content-type')
  if (!contentType) return undefined

  const mimeType = contentType.split(';')[0].trim()
  if (!mimeType) return undefined

  try {
    if (mimeType === 'text/plain') {
      return await body.text()
    } else if (/^application\/(?:[^+]+\+)?json$/i.test(mimeType)) {
      const json = await body.text().then(JSON.parse)

      if (typeof json === 'string') return json

      const errorDescription = ifString(ifObject(json)?.['error_description'])
      if (errorDescription) return errorDescription

      const error = ifString(ifObject(json)?.['error'])
      if (error) return error

      const message = ifString(ifObject(json)?.['message'])
      if (message) return message
    }
  } catch {
    // noop
  }

  return undefined
}

export class FetchResponseError extends FetchError {
  constructor(
    statusCode: number,
    message?: string,
    readonly body?: Blob | null,
    options?: FetchErrorOptions,
  ) {
    super(statusCode, message, options)
  }

  static async from(
    response: Response,
    status = response.status,
    customMessage?: string,
    options?: FetchErrorOptions,
  ) {
    // Make sure the body gets consumed as, in some environments (Node 👀), the
    // response will not be GC'd.
    const body = response.body
      ? !response.bodyUsed
        ? await response.blob()
        : undefined
      : null

    const message =
      customMessage ??
      (await extractResponseMessage(response.headers, body)) ??
      response.statusText

    return new FetchResponseError(status, message, body, {
      ...options,
      response,
    })
  }
}

export function fetchOkProcessor(): ResponseTranformer {
  return async (response) => {
    if (response.ok) return response

    throw await FetchResponseError.from(response)
  }
}

export function fetchMaxSizeProcessor(maxBytes: number): ResponseTranformer {
  if (maxBytes === Infinity) return (response) => response
  if (!Number.isFinite(maxBytes) || maxBytes < 0) {
    throw new TypeError('maxBytes must be a non-negative number')
  }
  return async (response) => fetchResponseMaxSize(response, maxBytes)
}

export async function fetchResponseMaxSize(
  response: Response,
  maxBytes: number,
): Promise<Response> {
  if (maxBytes === Infinity) return response
  if (!response.body) return response

  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const length = Number(contentLength)
    if (!(length < maxBytes)) {
      const err = new FetchResponseError(502, 'Response too large', undefined, {
        response,
      })
      await response.body.cancel(err)
      throw err
    }
  }

  let bytesRead = 0

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform: (
      chunk: Uint8Array,
      ctrl: TransformStreamDefaultController<Uint8Array>,
    ) => {
      if ((bytesRead += chunk.length) <= maxBytes) {
        ctrl.enqueue(chunk)
      } else {
        ctrl.error(
          new FetchResponseError(502, 'Response too large', undefined, {
            response,
          }),
        )
      }
    },
  })

  return new TransformedResponse(response, transform)
}

export type ContentTypeCheckFn = (contentType: string) => boolean
export type ContentTypeCheck = string | RegExp | ContentTypeCheckFn

export function fetchTypeProcessor(
  expectedType: ContentTypeCheck,
  contentTypeRequired = true,
): ResponseTranformer {
  const isExpected: ContentTypeCheckFn =
    typeof expectedType === 'string'
      ? (ct) => ct === expectedType
      : expectedType instanceof RegExp
        ? (ct) => expectedType.test(ct)
        : expectedType

  return async (response) => {
    const contentType = response.headers
      .get('content-type')
      ?.split(';')[0]!
      .trim()

    if (contentType) {
      if (!isExpected(contentType)) {
        throw await FetchResponseError.from(
          response,
          502,
          `Unexpected response Content-Type (${contentType})`,
        )
      }
    } else if (contentTypeRequired) {
      throw await FetchResponseError.from(
        response,
        502,
        'Missing response Content-Type header',
      )
    }

    return response
  }
}

export type ParsedJsonResponse<T = Json> = {
  response: Response
  json: T
}

export async function jsonTranformer<T = Json>(
  response: Response,
): Promise<ParsedJsonResponse<T>> {
  if (response.body === null) {
    throw new FetchResponseError(502, 'No response body', null, {
      response,
    })
  }

  if (response.bodyUsed) {
    throw new FetchResponseError(502, 'Response body already used', undefined, {
      response,
    })
  }

  // Read as blob to allow throwing with the body in case on invalid JSON (for debugging/logging purposes mainly)
  const body = await response.blob().catch(async (cause) => {
    throw new FetchResponseError(
      502,
      'Failed to read response body',
      undefined,
      { response, cause },
    )
  })

  try {
    const json = (await body.text().then(JSON.parse)) as T
    return { response, json }
  } catch (cause) {
    throw new FetchResponseError(502, 'Unable to parse response JSON', body, {
      response,
      cause,
    })
  }
}

export function fetchJsonProcessor<T = Json>(
  contentType: ContentTypeCheck = /^application\/(?:[^+]+\+)?json$/,
  contentTypeRequired = true,
): Transformer<Response, ParsedJsonResponse<T>> {
  return compose(
    fetchTypeProcessor(contentType, contentTypeRequired),
    jsonTranformer<T>,
  )
}

export function fetchJsonZodProcessor<S extends z.ZodTypeAny>(
  schema: S,
  params?: Partial<z.ParseParams>,
): Transformer<ParsedJsonResponse, z.infer<S>> {
  return async (jsonResponse: ParsedJsonResponse): Promise<z.infer<S>> =>
    schema.parseAsync(jsonResponse.json, params)
}
