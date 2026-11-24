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
  paramsToURLSearchParams,
} from '@atproto/lex-schema'
import { throwIfAborted } from './abort.js'
import type { Agent, AgentOptions } from './agent.js'
import { buildAgent } from './agent.js'
import {
  asUint8ArrayArrayBuffer,
  isAsyncIterable,
  isBlobLike,
  toReadableStream,
} from './body.js'
import type { XrpcFailure } from './errors.js'
import { XrpcFetchError, XrpcResponseError, asXrpcFailure } from './errors.js'
import type { XrpcRequestHeadersOptions } from './headers.js'
import { buildXrpcRequestHeaders } from './headers.js'
import type { IfXrpcStreamable, XrpcResponseOptions } from './response.js'
import {
  XrpcResponse,
  XrpcStreamResponse,
  assertXrpcStreamable,
} from './response.js'
import type { BinaryBodyInit } from './types.js'
import { wait } from './util.js'

/**
 * The query/path parameters type for an XRPC method, inferred from its schema.
 *
 * @typeParam M - The XRPC method type (Procedure, Query, or Subscription)
 */
export type XrpcRequestParams<M extends Procedure | Query | Subscription> =
  InferInput<M['parameters']>

/**
 * The params of an XRPC method, or a (possibly async) function returning them.
 * A function is invoked for every attempt: each retry of a request, and each
 * (re)connection of a subscription — which is how a subscription resumes from
 * the latest cursor.
 *
 * @typeParam P - The params type
 */
export type XrpcRequestParamsInit<P extends Params> = P | (() => P | Promise<P>)

/**
 * The `params` option of an XRPC method: optional when every parameter is.
 *
 * @typeParam P - The params type
 */
export type XrpcRequestParamsOptions<
  M extends Procedure | Query | Subscription,
> =
  NonNullable<unknown> extends XrpcRequestParams<M>
    ? { params?: XrpcRequestParamsInit<XrpcRequestParams<M>> }
    : { params: XrpcRequestParamsInit<XrpcRequestParams<M>> }

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
  XrpcRequestParamsOptions<M>

export type XrpcRequestProcessingOptions = {
  /**
   * AbortSignal to cancel the request.
   */
  signal?: AbortSignal

  /**
   * Whether to validate the request against the method's schema: its input
   * only when `true`, and its params (applying their defaults) unless `false`.
   * Validating the input can help catch errors early but may have a
   * performance cost, so it would typically only be enabled in development or
   * debugging scenarios.
   */
  validateRequest?: boolean

  /**
   * The {@link RequestInit.redirect redirect mode} of the request, which is
   * always passed explicitly to the fetch handler (as required by fetch
   * wrappers that enforce an explicit redirect policy, such as
   * `@atproto-labs/fetch-node`'s `safeFetchWrap`).
   *
   * - `"follow"`: redirects are followed by the fetch implementation.
   * - `"error"`: a redirect makes the request fail with an
   *   {@link XrpcFetchError}.
   * - `"manual"`: a redirect response is returned unfollowed, and the request
   *   fails with an {@link XrpcInvalidResponseError} exposing that response
   *   (whose `location` header is readable in server environments, while
   *   browsers return an opaque response with status `0`).
   *
   * @default "follow"
   */
  redirect?: RequestRedirect
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
 *
 * @see {@link xrpcStream} to stream binary payloads instead
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
  return xrpcRequest(agentOpts, ns, options, XrpcResponse.fromFetchResponse)
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
  XrpcResponse<M> | XrpcFailure<M>

/**
 * Makes an XRPC request, returning binary (non JSON) response payloads unread,
 * as a {@link ReadableStream}, and throws on failure.
 *
 * The caller owns the stream and must either consume it or cancel it, which
 * can be done through {@link XrpcStreamResponse.cancel}, or by disposing of
 * the response (`await using`). Error responses are still buffered. Only
 * accepts methods declaring a binary output (a non-JSON encoding, without
 * schema) or no output encoding at all.
 *
 * @returns The successful {@link XrpcStreamResponse}
 * @throws {XrpcFailure} When the request fails. This includes an
 * {@link XrpcInternalError} when the fetch implementation does not expose the
 * response body as a stream (e.g. React Native's built-in fetch).
 *
 * @example
 * ```typescript
 * await using response = await xrpcStream(agent, com.atproto.sync.getBlob.main, {
 *   params: { did, cid },
 * })
 *
 * for await (const chunk of response.body) {
 *   // ...
 * }
 * ```
 *
 * @see {@link xrpc} for the buffered variant
 */
export async function xrpcStream<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? IfXrpcStreamable<M, Main<M>>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcStreamResponse<M>>
export async function xrpcStream<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: IfXrpcStreamable<M, Main<M>>,
  options: XrpcOptions<M>,
): Promise<XrpcStreamResponse<M>>
export async function xrpcStream<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: IfXrpcStreamable<M, Main<M>>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcStreamResponse<M>> {
  const response = await xrpcStreamSafe(agentOpts, ns, options)
  if (response.success) return response
  else throw response
}

/**
 * Union type representing either a successful {@link XrpcStreamResponse} or a
 * failure. Both are disposable, allowing to dispose of the result (`await using`)
 * without narrowing it first.
 *
 * @typeParam M - The XRPC method type
 */
export type XrpcStreamResult<M extends Procedure | Query> =
  XrpcStreamResponse<M> | XrpcFailure<M>

/**
 * Same as {@link xrpcStream}, but returns failures instead of throwing them.
 *
 * @returns Either a successful {@link XrpcStreamResponse} or an
 * {@link XrpcFailure}, both of which are disposable.
 *
 * @example
 * ```typescript
 * await using result = await xrpcStreamSafe(agent, com.atproto.sync.getBlob.main, {
 *   params: { did, cid },
 * })
 *
 * if (result.success) {
 *   for await (const chunk of result.body) {
 *     // ...
 *   }
 * }
 * ```
 */
export async function xrpcStreamSafe<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: NonNullable<unknown> extends XrpcOptions<M>
    ? IfXrpcStreamable<M, Main<M>>
    : Restricted<'This XRPC method requires an "options" argument'>,
): Promise<XrpcStreamResult<M>>
export async function xrpcStreamSafe<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: IfXrpcStreamable<M, Main<M>>,
  options: XrpcOptions<M>,
): Promise<XrpcStreamResult<M>>
export async function xrpcStreamSafe<const M extends Query | Procedure>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcOptions<M> = {} as XrpcOptions<M>,
): Promise<XrpcStreamResult<M>> {
  const method: M = getMain(ns)

  // Reject untyped calls before sending the request
  try {
    assertXrpcStreamable(method)
  } catch (cause) {
    return asXrpcFailure(method, cause)
  }

  return xrpcRequest(
    agentOpts,
    ns,
    options,
    // @NOTE The method was asserted to be streamable above, which the
    // (deferred) IfXrpcStreamable<M, M> parameter type cannot reflect.
    XrpcStreamResponse.fromFetchResponse as unknown as (
      method: M,
      response: Response,
      options: XrpcResponseOptions,
    ) => Promise<XrpcStreamResponse<M>>,
  )
}

async function xrpcRequest<M extends Query | Procedure, R>(
  agentOpts: Agent | AgentOptions,
  ns: Main<M>,
  options: XrpcOptions<M>,
  fromFetchResponse: (
    method: M,
    response: Response,
    options: XrpcResponseOptions,
  ) => Promise<R>,
): Promise<R | XrpcFailure<M>> {
  const method: M = getMain(ns)

  for (let counter = 1; ; counter++) {
    throwIfAborted(options.signal)
    try {
      const agent = buildAgent(agentOpts)
      const url = await xrpcRequestUrl(method, options)
      const request = await xrpcRequestInit(method, options)
      const response = await agent.fetchHandler(url, request).catch((err) => {
        const cause = extractFetchErrorCause(err)
        throw new XrpcFetchError(method, cause)
      })
      return await fromFetchResponse(method, response, options)
    } catch (cause) {
      const failure = asXrpcFailure(method, cause)

      // Cannot retry a request with a consumable body
      if (
        // @NOTE ReadableStream is not defined in every environment (e.g.
        // React Native)
        (typeof ReadableStream === 'function' &&
          options.body instanceof ReadableStream) ||
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

/**
 * Builds the path (and query string) of an XRPC request, resolving the params
 * (see {@link XrpcRequestParamsInit}), validating them against the method's
 * schema and applying their defaults.
 */
export async function xrpcRequestUrl<
  M extends Procedure | Query | Subscription,
>(
  method: M,
  {
    params: paramsInput,
    signal,
    validateRequest = true,
  }: XrpcRequestProcessingOptions & XrpcRequestParamsOptions<M>,
): Promise<`/xrpc/${NsidString}${'' | `?${string}`}`> {
  const path = `/xrpc/${method.nsid}` as const

  const { parameters } = method
  if (!parameters) return path

  const paramsObject =
    typeof paramsInput === 'function' ? await paramsInput() : paramsInput

  if (signal) throwIfAborted(signal)

  // @NOTE Parsing also applies the params' defaults, so that a server with
  // different defaults still receives every expected parameter. It is only
  // skipped, along with validation, when options.validateRequest is false.
  const paramsParsed: Params | undefined = validateRequest
    ? parameters.parse(paramsObject ?? {})
    : paramsObject

  if (!paramsParsed) return path

  const queryString = paramsToURLSearchParams(paramsParsed)
  if (!queryString.size) return path

  return `${path}?${queryString}` as const
}

async function xrpcRequestInit<T extends Procedure | Query>(
  schema: T,
  options: XrpcRequestProcessingOptions &
    XrpcRequestHeadersOptions &
    XrpcProcedureInputOptions & {
      encoding?: string
    },
): Promise<RequestInit & { duplex?: 'half' }> {
  const headers = await buildXrpcRequestHeaders(options)

  throwIfAborted(options.signal)

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
      redirect: options.redirect ?? 'follow',
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
    redirect: options.redirect ?? 'follow',
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
        // @NOTE ReadableStream is not defined in every environment (e.g.
        // React Native)
        (typeof ReadableStream === 'function' && body instanceof ReadableStream)
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
