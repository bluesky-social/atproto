import type { ParseParams, TypeOf, ZodTypeAny } from 'zod'
import { Transformer, pipe } from '@atproto-labs/pipe'
import { FetchError } from './fetch-error.js'
import { TransformedResponse } from './transformed-response.js'
import {
  Json,
  MaxBytesTransformStream,
  cancelBody,
  ifObject,
  ifString,
  logCancellationError,
} from './util.js'

/**
 * media-type     = type "/" subtype *( ";" parameter )
 * type           = token
 * subtype        = token
 * token          = 1*<any CHAR except CTLs or separators>
 * separators     = "(" | ")" | "<" | ">" | "@"
 *                | "," | ";" | ":" | "\" | <">
 *                | "/" | "[" | "]" | "?" | "="
 *                | "{" | "}" | SP | HT
 * CTL            = <any US-ASCII control character (octets 0 - 31) and DEL (127)>
 * SP             = <US-ASCII SP, space (32)>
 * HT             = <US-ASCII HT, horizontal-tab (9)>
 * @note The type, subtype, and parameter attribute names are case-insensitive.
 * @see {@link https://datatracker.ietf.org/doc/html/rfc2616#autoid-23}
 */
const JSON_MIME = /^application\/(?:[^()<>@,;:/[\]\\?={} \t]+\+)?json$/i

export type ResponseTransformer = Transformer<Response>
export type ResponseMessageGetter = Transformer<Response, string | undefined>

export class FetchResponseError extends FetchError {
  constructor(
    public readonly response: Response,
    statusCode: number = response.status,
    message: string = response.statusText,
    options?: ErrorOptions,
  ) {
    super(statusCode, message, options)
  }

  static async from(
    response: Response,
    customMessage: string | ResponseMessageGetter = extractResponseMessage,
    statusCode = response.status,
    options?: ErrorOptions,
  ) {
    const message =
      typeof customMessage === 'string'
        ? customMessage
        : typeof customMessage === 'function'
          ? await customMessage(response)
          : undefined

    return new FetchResponseError(response, statusCode, message, options)
  }
}

const extractResponseMessage: ResponseMessageGetter = async (response) => {
  const mimeType = extractMime(response)
  if (!mimeType) return undefined

  try {
    if (mimeType === 'text/plain') {
      return await response.text()
    } else if (JSON_MIME.test(mimeType)) {
      const json: unknown = await response.json()

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

export async function peekJson(
  response: Response,
  maxSize = Infinity,
): Promise<undefined | Json> {
  const type = extractMime(response)
  if (type !== 'application/json') return undefined
  checkLength(response, maxSize)

  // 1) Clone the request so we can consume the body
  const clonedResponse = response.clone()

  // 2) Make sure the request's body is not too large
  const limitedResponse =
    response.body && maxSize < Infinity
      ? new TransformedResponse(
          clonedResponse,
          new MaxBytesTransformStream(maxSize),
        )
      : // Note: some runtimes (e.g. react-native) don't expose a body property
        clonedResponse

  // 3) Parse the JSON
  return limitedResponse.json()
}

export function checkLength(response: Response, maxBytes: number) {
  // Note: negation accounts for invalid value types (NaN, non numbers)
  if (!(maxBytes >= 0)) {
    throw new TypeError('maxBytes must be a non-negative number')
  }
  const length = extractLength(response)
  if (length != null && length > maxBytes) {
    throw new FetchResponseError(response, 502, 'Response too large')
  }
  return length
}

export function extractLength(response: Response) {
  const contentLength = response.headers.get('Content-Length')
  if (contentLength == null) return undefined
  if (!/^\d+$/.test(contentLength)) {
    throw new FetchResponseError(response, 502, 'Invalid Content-Length')
  }
  const length = Number(contentLength)
  if (!Number.isSafeInteger(length)) {
    throw new FetchResponseError(response, 502, 'Content-Length too large')
  }
  return length
}

export function extractMime(response: Response) {
  const contentType = response.headers.get('Content-Type')
  if (contentType == null) return undefined

  return contentType.split(';', 1)[0]!.trim()
}

/**
 * If the transformer results in an error, ensure that the response body is
 * consumed as, in some environments (Node 👀), the response will not
 * automatically be GC'd.
 *
 * @see {@link https://undici.nodejs.org/#/?id=garbage-collection}
 * @param [onCancellationError] - Callback to handle any async body cancelling
 * error. Defaults to logging the error. Do not use `null` if the request is
 * cloned.
 */
export function cancelBodyOnError<T>(
  transformer: Transformer<Response, T>,
  onCancellationError: null | ((err: unknown) => void) = logCancellationError,
): (response: Response) => Promise<T> {
  return async (response) => {
    try {
      return await transformer(response)
    } catch (err) {
      await cancelBody(response, onCancellationError ?? undefined)
      throw err
    }
  }
}

export function fetchOkProcessor(
  customMessage?: string | ResponseMessageGetter,
): ResponseTransformer {
  return cancelBodyOnError((response) => {
    return fetchOkTransformer(response, customMessage)
  })
}

export async function fetchOkTransformer(
  response: Response,
  customMessage?: string | ResponseMessageGetter,
) {
  if (response.ok) return response
  throw await FetchResponseError.from(response, customMessage)
}

export function fetchMaxSizeProcessor(maxBytes: number): ResponseTransformer {
  if (maxBytes === Infinity) return (response) => response
  if (!Number.isFinite(maxBytes) || maxBytes < 0) {
    throw new TypeError('maxBytes must be a 0, Infinity or a positive number')
  }
  return cancelBodyOnError((response) => {
    return fetchResponseMaxSizeChecker(response, maxBytes)
  })
}

export function fetchResponseMaxSizeChecker(
  response: Response,
  maxBytes: number,
): Response {
  if (maxBytes === Infinity) return response
  checkLength(response, maxBytes)

  // Some engines (react-native 👀) don't expose a body property. In that case,
  // we will only rely on the Content-Length header.
  if (!response.body) return response

  const transform = new MaxBytesTransformStream(maxBytes)
  return new TransformedResponse(response, transform)
}

export type MimeTypeCheckFn = (mimeType: string) => boolean
export type MimeTypeCheck = string | RegExp | MimeTypeCheckFn

export function fetchTypeProcessor(
  expectedMime: MimeTypeCheck,
  contentTypeRequired = true,
): ResponseTransformer {
  const isExpected: MimeTypeCheckFn =
    typeof expectedMime === 'string'
      ? (mimeType) => mimeType === expectedMime
      : expectedMime instanceof RegExp
        ? (mimeType) => expectedMime.test(mimeType)
        : expectedMime

  return cancelBodyOnError((response) => {
    return fetchResponseTypeChecker(response, isExpected, contentTypeRequired)
  })
}

export async function fetchResponseTypeChecker(
  response: Response,
  isExpectedMime: MimeTypeCheckFn,
  contentTypeRequired = true,
): Promise<Response> {
  const mimeType = extractMime(response)
  if (mimeType) {
    if (!isExpectedMime(mimeType.toLowerCase())) {
      throw await FetchResponseError.from(
        response,
        `Unexpected response Content-Type (${mimeType})`,
        502,
      )
    }
  } else if (contentTypeRequired) {
    throw await FetchResponseError.from(
      response,
      'Missing response Content-Type header',
      502,
    )
  }

  return response
}

export type ParsedJsonResponse<T = Json> = {
  response: Response
  json: T
}

export async function fetchResponseJsonTransformer<T = Json>(
  response: Response,
): Promise<ParsedJsonResponse<T>> {
  try {
    const json = (await response.json()) as T
    return { response, json }
  } catch (cause) {
    throw new FetchResponseError(
      response,
      502,
      'Unable to parse response as JSON',
      { cause },
    )
  }
}

export function fetchJsonProcessor<T = Json>(
  expectedMime: MimeTypeCheck = JSON_MIME,
  contentTypeRequired = true,
): Transformer<Response, ParsedJsonResponse<T>> {
  return pipe(
    fetchTypeProcessor(expectedMime, contentTypeRequired),
    cancelBodyOnError(fetchResponseJsonTransformer<T>),
  )
}

export function fetchJsonZodProcessor<S extends ZodTypeAny>(
  schema: S,
  params?: Partial<ParseParams>,
): Transformer<ParsedJsonResponse, TypeOf<S>> {
  return async (jsonResponse: ParsedJsonResponse): Promise<TypeOf<S>> =>
    schema.parseAsync(jsonResponse.json, params)
}
