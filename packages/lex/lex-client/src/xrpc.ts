import type { LexValue } from '@atproto/lex-data'
import { isLexScalar, isPlainObject } from '@atproto/lex-data'
import { lexStringify } from '@atproto/lex-json'
import {
  type InferInput,
  type InferPayload,
  type Main,
  type NsidString,
  type Params,
  type Payload,
  type Procedure,
  type Query,
  type Restricted,
  type Subscription,
  getMain,
} from '@atproto/lex-schema'
import type { Agent, AgentOptions } from './agent.js'
import { buildAgent } from './agent.js'
import type { XrpcFailure } from './errors.js'
import { XrpcFetchError, XrpcResponseError, asXrpcFailure } from './errors.js'
import type { XrpcResponseOptions } from './response.js'
import { XrpcResponse } from './response.js'
import type { BinaryBodyInit } from './types.js'
import type { XrpcRequestHeadersOptions } from './util.js'
import {
  asUint8ArrayArrayBuffer,
  buildXrpcRequestHeaders,
  isAsyncIterable,
  isBlobLike,
  toReadableStream,
  wait,
} from './util.js'

/**
 * The query/path parameters type for an XRPC method, inferred from its schema.
 *
 * @typeParam M - The XRPC method type (Procedure, Query, or Subscription)
 */
export type XrpcRequestParams<M extends Procedure | Query | Subscription> =
  InferInput<M['parameters']>

// If all params are optional, allow omitting the params object
type XrpcRequestParamsOptions<P extends Params> =
  NonNullable<unknown> extends P ? { params?: P } : { params: P }

type XrpcRequestPayload<M extends Procedure | Query> = M extends Procedure
  ? InferPayload<M['input'], BinaryBodyInit>
  : undefined

type XrpcRequestPayloadOptions<TPayload> = TPayload extends {
  body: infer B
  encoding: infer E
}
  ? {
      body: B

      /**
       * mime type hint for binary bodies
       *
       * Only needed for endpoints that accept binary input (e.g. file uploads)
       * when the body is a Blob-like object without a type (e.g. fetch-blob's
       * Blob). If the body is a Blob-like object with a type, that type will be
       * used as the content-type header instead of this option.
       *
       * @default "application/octet-stream"
       */
      encoding?: E
    }
  : { body?: undefined; encoding?: undefined }

/**
 * Options for making an XRPC request, based on the method schema.
 *
 * Combines {@link XrpcRequestOptions} and {@link XrpcResponseOptions} with
 * method-specific params and body requirements. The type system ensures
 * required params/body are provided based on the method schema.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 *
 * @example Query with params
 * ```typescript
 * const options: XrpcOptions<typeof app.bsky.feed.getTimeline.main> = {
 *   params: { limit: 50 }
 * }
 * ```
 *
 * @example Procedure with body
 * ```typescript
 * const options: XrpcOptions<typeof com.atproto.repo.createRecord.main> = {
 *   body: { repo: did, collection: 'app.bsky.feed.post', record: { ... } }
 * }
 * ```
 */
export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  XrpcRequestOptions<M> & XrpcResponseOptions & RetryOptions

export type XrpcRequestOptions<
  M extends Procedure | Query = Procedure | Query,
> = XrpcRequestProcessingOptions &
  XrpcRequestHeadersOptions &
  XrpcRequestPayloadOptions<XrpcRequestPayload<M>> &
  XrpcRequestParamsOptions<XrpcRequestParams<M>>

export type XrpcRequestProcessingOptions = {
  /**
   * AbortSignal to cancel the request.
   */
  signal?: AbortSignal

  /**
   * Whether to validate the request against the method's input schema. Enabling
   * this can help catch errors early but may have a performance cost. This
   * would typically only be set to `true` in development or debugging
   * scenarios.
   *
   * @default false
   */
  validateRequest?: boolean
}

/**
 * Makes an XRPC request and throws on failure.
 *
 * This is the low-level function for making XRPC calls.
 *
 * @param agent - The {@link Agent} to use for making the request
 * @param ns - The lexicon method definition
 * @param options - Request {@link XrpcOptions options} (params, body, headers, etc.)
 * @returns The successful {@link XrpcResponse}
 * @throws {XrpcFailure} When the request fails
 *
 * @example
 * ```typescript
 * const response = await xrpc('https://bsky.network', com.atproto.identity.resolveHandle, {
 *   params: { handle: "atproto.com" }
 * })
 * ```
 *
 * @example
 * ```typescript
 * const response = await xrpc(agent, app.bsky.feed.getTimeline.main, {
 *   params: { limit: 50 }
 * })
 * ```
 */
export async function xrpc<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? Main<M>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcResponse<M>>
export async function xrpc<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcOptions<M>,
): Promise<XrpcResponse<M>>
export async function xrpc<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcResponse<M>> {
  const response = await xrpcSafe<M>(agentOpts, ns, options)
  if (response.success) return response
  else throw response
}

/**
 * Union type representing either a successful response or a failure.
 *
 * Both {@link XrpcResponse} and {@link XrpcFailure} have a `success` property
 * that can be used to discriminate between them.
 *
 * @typeParam M - The XRPC method type
 */
export type XrpcResult<M extends Procedure | Query> =
  | XrpcResponse<M>
  | XrpcFailure<M>

/**
 * Makes an XRPC request without throwing on failure.
 *
 * Returns a discriminated union that can be checked via the `success` property.
 * This is useful for handling errors without try/catch blocks. This also allows
 * failure results to be typed with the method schema, which can provide better
 * type safety when handling errors (e.g. checking for specific error codes).
 *
 * @param agent - The {@link Agent} to use for making the request
 * @param ns - The lexicon method definition
 * @param options - Request {@link XrpcOptions options} (params, body, headers, etc.)
 * @returns Either a successful {@link XrpcResponse} or an {@link XrpcFailure}
 *
 * @example
 * ```typescript
 * const result = await xrpcSafe('https://example.com', app.bsky.actor.getProfile, {
 *   params: { actor: 'alice.bsky.social' }
 * })
 *
 * if (result.success) {
 *   console.log(result.body.displayName)
 * } else {
 *   console.error('Request failed:', result.error)
 * }
 * ```
 */
export async function xrpcSafe<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? Main<M>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcResult<M>>
export async function xrpcSafe<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcOptions<M>,
): Promise<XrpcResult<M>>
export async function xrpcSafe<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcResult<M>> {
  const method: M = getMain(ns)

  for (let counter = 1; ; counter++) {
    options.signal?.throwIfAborted()
    try {
      const agent = buildAgent(agentOpts)
      const url = xrpcRequestUrl(method, options)
      const request = xrpcRequestInit(method, options)
      const response = await agent.fetchHandler(url, request).catch((err) => {
        const cause = extractFetchErrorCause(err)
        throw new XrpcFetchError(method, cause)
      })
      return await XrpcResponse.fromFetchResponse<M>(method, response, options)
    } catch (cause) {
      const failure = asXrpcFailure(method, cause)

      // Cannot retry a request with a consumable body
      if (
        options.body instanceof ReadableStream ||
        isAsyncIterable(options.body)
      ) {
        return failure
      }

      const waitTime = getRetryWaitTime(failure, options, counter)
      if (waitTime == null) {
        return failure
      }

      await wait(waitTime, options)
    }
  }
}

function xrpcRequestUrl<M extends Procedure | Query | Subscription>(
  method: M,
  options: { params?: Params },
): `/xrpc/${NsidString}${'' | `?${string}`}` {
  const path = `/xrpc/${method.nsid}` as const

  // @NOTE param.toURLSearchParams() will always validate the params in order to
  // apply default values, so we can't disable it with options.validateRequest

  const queryString = method.parameters
    ?.toURLSearchParams(options.params ?? {})
    .toString()

  return queryString ? (`${path}?${queryString}` as const) : path
}

function xrpcRequestInit<T extends Procedure | Query>(
  schema: T,
  options: XrpcRequestProcessingOptions &
    XrpcRequestHeadersOptions &
    XrpcProcedureInputOptions & {
      encoding?: string
    },
): RequestInit & { duplex?: 'half' } {
  const headers = buildXrpcRequestHeaders(options)

  // Tell the server what type of response we're expecting
  if (schema.output.encoding) {
    headers.set('accept', schema.output.encoding)
  }

  // Caller should not set content-type header
  if (headers.has('content-type')) {
    const contentType = headers.get('content-type')
    throw new TypeError(`Unexpected content-type header (${contentType})`)
  }

  // Requests with body
  if ('input' in schema) {
    const encodingHint = options.encoding
    const input = xrpcProcedureInput(schema, options, encodingHint)

    if (input) {
      headers.set('content-type', input.encoding)
    } else if (encodingHint != null) {
      throw new TypeError(`Unexpected encoding hint (${encodingHint})`)
    }

    return {
      duplex: 'half',
      redirect: 'follow',
      referrerPolicy: 'strict-origin-when-cross-origin', // (default)
      mode: 'cors', // (default)
      signal: options.signal,
      method: 'POST',
      headers,
      body: input?.body,
    }
  }

  // Requests without body
  return {
    duplex: 'half',
    redirect: 'follow',
    referrerPolicy: 'strict-origin-when-cross-origin', // (default)
    mode: 'cors', // (default)
    signal: options.signal,
    method: 'GET',
    headers,
  }
}

type XrpcProcedureInputOptions = {
  body?: LexValue | BinaryBodyInit
  validateRequest?: boolean
}

function xrpcProcedureInput(
  method: Procedure,
  options: XrpcProcedureInputOptions,
  encodingHint?: string,
): null | { body: BodyInit; encoding: string } {
  const { input } = method
  const { body } = options

  if (options.validateRequest) {
    input.schema?.check(body)
  }

  // Special handling for endpoints expecting application/json input
  if (input.encoding === 'application/json') {
    // @NOTE **NOT** using isLexValue here to avoid deep checks in order to
    // distinguish between LexValue and BinaryBodyInit.
    if (!isLexScalar(body) && !isPlainObject(body) && !Array.isArray(body)) {
      throw new TypeError(`Expected LexValue body, got ${typeof body}`)
    }

    return buildPayload(input, lexStringify(body), encodingHint)
  }

  // Other encodings will be sent unaltered (ie. as binary data)
  switch (typeof body) {
    case 'undefined':
    case 'string':
      return buildPayload(input, body, encodingHint)
    case 'object': {
      if (body === null) break
      if (ArrayBuffer.isView(body)) {
        return buildPayload(input, asUint8ArrayArrayBuffer(body), encodingHint)
      } else if (
        body instanceof ArrayBuffer ||
        body instanceof ReadableStream
      ) {
        return buildPayload(input, body, encodingHint)
      } else if (isAsyncIterable(body)) {
        // @NOTE While fetch() does not allow SharedArrayBuffer-backed
        // Uint8Arrays as "body", it **does** allow using ReadableStreams made
        // of Uint8Arrays<SharedArrayBuffer> (tested on NodeJS 22) as "body".
        return buildPayload(input, toReadableStream(body), encodingHint)
      } else if (isBlobLike(body)) {
        return buildPayload(input, body, encodingHint || body.type)
      }
    }
  }

  throw new TypeError(
    `Invalid ${typeof body} body for ${input.encoding} encoding`,
  )
}

function buildPayload(
  schema: Payload,
  body: undefined | BodyInit,
  encodingHint?: string,
): null | { body: BodyInit; encoding: string } {
  if (schema.encoding === undefined) {
    if (body !== undefined) {
      throw new TypeError(`Endpoint expects no payload`)
    }

    return null
  }

  if (body === undefined) {
    // This error would be returned by the server, but we can catch it earlier
    // to avoid un-necessary requests. Note that a content-length of 0 does not
    // necessary mean that the body is "empty" (e.g. an empty txt file).
    throw new TypeError(`A request body is expected but none was provided`)
  }

  const encoding = buildEncoding(schema, encodingHint)
  return { encoding, body }
}

function buildEncoding(schema: Payload, encodingHint?: string): string {
  // Should never happen (required for type safety)
  if (!schema.encoding) {
    throw new TypeError('Unexpected payload')
  }

  if (encodingHint?.length) {
    if (!schema.matchesEncoding(encodingHint)) {
      throw new TypeError(
        `Cannot send a body with content-type "${encodingHint}" for "${schema.encoding}" encoding`,
      )
    }
    return encodingHint
  }

  // Fallback

  if (schema.encoding === '*/*') {
    return 'application/octet-stream'
  }

  if (schema.encoding.startsWith('text/')) {
    return schema.encoding.includes('*')
      ? 'text/plain; charset=utf-8'
      : `${schema.encoding}; charset=utf-8`
  }

  if (!schema.encoding.includes('*')) {
    return schema.encoding
  }

  throw new TypeError(
    `Unable to determine payload encoding. Please provide a 'content-type' header matching ${schema.encoding}.`,
  )
}

/**
 * Extracts the root cause from an error, unwrapping common fetch-related errors
 * such as those from undici (Node's internal fetch implementation).
 *
 * @param err - The error to extract the root cause from
 * @returns The root cause error, or the original error if no specific pattern is matched
 * @remarks This is useful for getting more specific error information from fetch-related failures, especially in Node environments using undici.
 */
export function extractFetchErrorCause(err: unknown): unknown {
  // Unwrap the Network error from undici (i.e. Node's internal fetch() implementation)
  // https://github.com/nodejs/undici/blob/04cb77327f7ada95c2e5b67424cddcb22d7bf882/lib/web/fetch/index.js#L234-L239
  if (
    err instanceof TypeError &&
    err.message === 'fetch failed' &&
    err.cause !== undefined
  ) {
    return err.cause
  }

  // @TODO Add other unwrap patterns here as needed (e.g. for other fetch
  // implementations or common network libraries, like "node:http", or in other
  // environments like React Native, Deno, Bun, Browser, etc.)

  return err
}

export type RetryOptions = {
  /**
   * Function to determine whether a request should be retried after a failure.
   *
   * @default `(failure) => failure.shouldRetry()`
   */
  retry?: (failure: XrpcFailure, context: { counter: number }) => boolean
  /**
   * Maximum number of retries to allow.
   *
   * @default 0 (no retries)
   */
  maxRetries?: number
  /**
   * Max number of milliseconds allow between retries
   *
   * @default 30000
   */
  maxRetryTimeout?: number
  /**
   * Initial number of milliseconds to wait before retrying for the first time.
   *
   * @default 500
   */
  minRetryTimeout?: number
  /**
   * Factor to multiply the timeout factor between retries.
   *
   * @default 2
   */
  retryTimeoutFactor?: number
  /**
   * Automatically infer timeout between retries based on header values (`Retry-After`, `RateLimit-Reset`).
   *
   * @default true
   */
  retryHeaders?: boolean
}

function getRetryWaitTime(
  failure: XrpcFailure,
  options: RetryOptions,
  counter: number,
): number | undefined {
  const {
    retry,
    maxRetries = 0,
    minRetryTimeout = 500,
    maxRetryTimeout = 30_000,
    retryTimeoutFactor = 2,
    retryHeaders = true,
  } = options

  if (counter > maxRetries) {
    return undefined
  }

  const shouldRetry = retry
    ? retry(failure, { counter })
    : failure.shouldRetry()

  if (!shouldRetry) {
    return undefined
  }

  const waitTime =
    retryHeaders && failure instanceof XrpcResponseError
      ? getWaitTimeFromHeaders(failure.headers)
      : undefined

  return Math.min(
    maxRetryTimeout,
    waitTime ?? minRetryTimeout * retryTimeoutFactor ** (counter - 1),
  )
}

function getWaitTimeFromHeaders(headers: Headers): number | undefined {
  const retryAfterHeader = headers.get('retry-after')
  if (retryAfterHeader) {
    const waitTime = /^\s*\d+\s*$/.test(retryAfterHeader)
      ? // Retry-After is in seconds
        Number(retryAfterHeader) * 1000
      : // Retry-After is an http-date
        new Date(retryAfterHeader).getTime() - Date.now()
    if (waitTime > 0) return waitTime
  }

  const resetsAt = headers.get('RateLimit-Reset') // epoch
  if (resetsAt) {
    const waitTime = Number(resetsAt) * 1000 - Date.now()
    if (waitTime > 0) return waitTime
  }
}
