import { Transformer, pipe } from '@atproto-labs/pipe'
import { z } from 'zod'

import { FetchError, FetchErrorOptions } from './fetch-error.js'
import { TransformedResponse } from './transformed-response.js'
import { Json, MaxBytesTransformStream, ifObject, ifString } from './util.js'

export type ResponseTranformer = Transformer<Response>
export type ResponseMessageGetter = Transformer<Response, string | undefined>

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

const extractResponseMessage: ResponseMessageGetter = async (response) => {
  const mimeType = extractMime(response)
  if (!mimeType) return undefined

  try {
    if (mimeType === 'text/plain') {
      return await response.text()
    } else if (/^application\/(?:[^+]+\+)?json$/i.test(mimeType)) {
      const json = await response.json()

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
    response: Response,
    statusCode: number = response.status,
    message: string = response.statusText,
    options?: Omit<FetchErrorOptions, 'response'>,
  ) {
    super(statusCode, message, { response, ...options })
  }

  static async from(
    response: Response,
    customMessage: string | ResponseMessageGetter = extractResponseMessage,
    statusCode = response.status,
    options?: Omit<FetchErrorOptions, 'response'>,
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

export function logCancellationError(err: unknown): void {
  console.warn('Failed to cancel response body', err)
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

/**
 * @param [onCancellationError] - Callback that will trigger to asynchronously
 * handle any error that occurs while cancelling the response body. Providing
 * this will speed up the process and avoid potential deadlocks. Defaults to
 * awaiting the cancellation operation. use `"log"` to log the error.
 * @see {@link https://undici.nodejs.org/#/?id=garbage-collection}
 * @note awaiting this function's result, when no `onCancellationError` is
 * provided, might result in a dead lock. Indeed, if the response was cloned(),
 * the response.body.cancel() method will not resolve until the other response's
 * body is consumed/cancelled.
 *
 * @example
 * ```ts
 * // Make sure response was not cloned, or that every cloned response was
 * // consumed/cancelled before awaiting this function's result.
 * await cancelBody(response)
 * ```
 * @example
 * ```ts
 * await cancelBody(response, (err) => {
 *   // No biggie, let's just log the error
 *   console.warn('Failed to cancel response body', err)
 * })
 * ```
 * @example
 * ```ts
 * // Will generate an "unhandledRejection" if an error occurs while cancelling
 * // the response body. This will likely crash the process.
 * await cancelBody(response, (err) => { throw err })
 * ```
 */
export async function cancelBody(
  input: Response | Request,
  onCancellationError?: 'log' | ((err: unknown) => void),
): Promise<void> {
  if (
    input.body &&
    !input.bodyUsed &&
    !input.body.locked &&
    // Support for alternative fetch implementations
    typeof input.body.cancel === 'function'
  ) {
    if (typeof onCancellationError === 'function') {
      void input.body.cancel().catch(onCancellationError)
    } else if (onCancellationError === 'log') {
      void input.body.cancel().catch(logCancellationError)
    } else {
      await input.body.cancel()
    }
  }
}

export function fetchOkProcessor(
  customMessage?: string | ResponseMessageGetter,
): ResponseTranformer {
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

export function fetchMaxSizeProcessor(maxBytes: number): ResponseTranformer {
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
): ResponseTranformer {
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
    if (!isExpectedMime(mimeType)) {
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

export async function fetchResponseJsonTranformer<T = Json>(
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
  expectedMime: MimeTypeCheck = /^application\/(?:[^+]+\+)?json$/,
  contentTypeRequired = true,
): Transformer<Response, ParsedJsonResponse<T>> {
  return pipe(
    fetchTypeProcessor(expectedMime, contentTypeRequired),
    cancelBodyOnError(fetchResponseJsonTranformer<T>),
  )
}

export function fetchJsonZodProcessor<S extends z.ZodTypeAny>(
  schema: S,
  params?: Partial<z.ParseParams>,
): Transformer<ParsedJsonResponse, z.infer<S>> {
  return async (jsonResponse: ParsedJsonResponse): Promise<z.infer<S>> =>
    schema.parseAsync(jsonResponse.json, params)
}
