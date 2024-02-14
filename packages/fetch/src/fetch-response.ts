import { Transformer, compose } from '@atproto/transformer'
import { z } from 'zod'

import { FetchError } from './fetch-error.js'
import { overrideResponseBody } from './utils.js'

export type ResponseTranformer = Transformer<Response>

export function fetchOkProcessor(): ResponseTranformer {
  return async (response) => {
    if (!response.ok) {
      throw new FetchError(response.status, response.statusText, { response })
    }

    return response
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

type ParsedJsonResponse<Body = unknown> = {
  status: number
  headers: Headers
  body: Body
}

export async function jsonTranformer<Body = unknown>(
  response: Response,
): Promise<ParsedJsonResponse<Body>> {
  return response
    .json()
    .then((body) => ({
      status: response.status,
      headers: response.headers,
      body: body as Body,
    }))
    .catch((err) => {
      throw new FetchError(502, err, { response })
    })
}

export function fetchJsonProcessor<Body = unknown>(
  contentType: ContentTypeCheck = /^application\/(?:[^+]+\+)?json$/,
  contentTypeRequired = true,
): Transformer<Response, ParsedJsonResponse<Body>> {
  return compose(
    fetchTypeProcessor(contentType, contentTypeRequired),
    jsonTranformer<Body>,
  )
}

export function fetchZodProcessor<S extends z.ZodTypeAny>(
  schema: S,
  params?: Partial<z.ParseParams>,
): Transformer<ParsedJsonResponse, z.infer<S>> {
  return async ({
    body,
    ...rest
  }: ParsedJsonResponse): Promise<ParsedJsonResponse<z.infer<S>>> => ({
    body: schema.parseAsync(body, params),
    ...rest,
  })
}

export function fetchZodBodyProcessor<S extends z.ZodTypeAny>(
  schema: S,
  params?: Partial<z.ParseParams>,
): Transformer<ParsedJsonResponse, z.infer<S>> {
  return async (jsonResponse: ParsedJsonResponse): Promise<z.infer<S>> =>
    schema.parseAsync(jsonResponse.body, params)
}
