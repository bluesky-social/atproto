import { Transformer, compose } from '@atproto/transformer'
import { z } from 'zod'

import { FetchError, FetchErrorOptions } from './fetch-error.js'
import { overrideResponseBody } from './utils.js'

export type ResponseTranformer = Transformer<Response>

async function extractResponseMessage(response: Response): Promise<string> {
  try {
    const contentType = response.headers
      .get('content-type')
      ?.split(';')[0]
      .trim()
    if (contentType && response.body && !response.bodyUsed) {
      if (contentType === 'text/plain') {
        return response.clone().text()
      } else if (/^application\/(?:[^+]+\+)?json$/i.test(contentType)) {
        const json = await response.clone().json()
        if (typeof json?.error_description === 'string') {
          return json.error_description
        } else if (typeof json?.error === 'string') {
          return json.error
        } else if (typeof json?.message === 'string') {
          return json.message
        }
      }
    }
  } catch {
    // noop
  }
  return response.statusText
}

export class FetchResponseError extends FetchError {
  constructor(
    statusCode: number,
    message?: string,
    public readonly body?: Blob,
    options?: FetchErrorOptions,
  ) {
    super(statusCode, message, options)
  }

  static async from(response: Response) {
    const message = await extractResponseMessage(response)
    const body: undefined | Blob =
      response.body && !response.bodyUsed
        ? await response.clone().blob()
        : undefined

    return new FetchResponseError(response.status, message, body, {
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
  if (!(maxBytes >= 0)) throw new TypeError('maxBytes must be >= 0')
  if (maxBytes === Infinity) return (response) => response

  return async (response) => {
    if (!response.body) return response

    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      const length = Number(contentLength)
      if (!(length < maxBytes)) {
        const err = new FetchError(502, 'Response too large', { response })
        await response.body.cancel(err)
        throw err
      }
    }

    let bytesRead = 0

    // @ts-ignore - @types/node does not have ReadableStream as global
    const newBody: ReadableStream<Uint8Array> = response.body.pipeThrough(
      // @ts-ignore - @types/node does not have TransformStream as global
      new TransformStream<Uint8Array, Uint8Array>({
        transform: (
          chunk: Uint8Array,
          // @ts-ignore - @types/node does not have TransformStreamDefaultController as global
          ctrl: TransformStreamDefaultController<Uint8Array>,
        ) => {
          if ((bytesRead += chunk.length) <= maxBytes) {
            ctrl.enqueue(chunk)
          } else {
            ctrl.error(new FetchError(502, 'Response too large', { response }))
          }
        },
      }),
    )

    return overrideResponseBody(response, newBody)
  }
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
        throw new FetchError(
          502,
          `Unexpected response Content-Type (${contentType})`,
          {
            response,
          },
        )
      }
    } else if (contentTypeRequired) {
      throw new FetchError(502, 'Missing response Content-Type header', {
        response,
      })
    }

    return response
  }
}

export type ParsedJsonResponse<T = unknown> = {
  response: Response
  json: T
}

export async function jsonTranformer<T = unknown>(
  response: Response,
): Promise<ParsedJsonResponse<T>> {
  return response
    .json()
    .then((json) => ({
      response,
      json: json as T,
    }))
    .catch((err) => {
      throw new FetchError(502, err, { response })
    })
}

export function fetchJsonProcessor<T = unknown>(
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
